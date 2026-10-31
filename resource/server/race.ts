import { aiLog, isNear, notify } from "@aicore-fivem/lib/server";
import { groupDigits, type Vec3 } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import {
  COUNTDOWN_MS,
  EVENTS,
  type InviteView,
  type RaceView,
} from "common/race";
import { driving, finishHolds, maybeAlertPolice } from "./checks";
import { Purse } from "./purse";

export interface RaceOptions {
  id: number;
  host: number;
  hostName: string;
  start: Vec3;
  finish: { x: number; y: number };
  buyIn: number;
  account: string;
  joinEndsAt: number;
  maxMs: number;
  maxRacers: number;
  /** A racer farther than this from the start when the join time ends is sent home with a refund. */
  readyRadius: number;
  alertChance: number;
}

/** What the race tells its registry: a player is no longer in it, the race is over. */
export interface RaceHooks {
  out(source: number): void;
  ended(race: StreetRace): void;
}

type CancelReason =
  "RACE_CANCELLED_HOST" | "RACE_CANCELLED_EMPTY" | "RACE_CANCELLED_STOP";

const money = (amount: number): string => groupDigits(amount);

/**
 * One street race: a lobby until the join time ends (or the host starts it), a countdown, then running until the
 * first racer reaches the finish (takes the pot) or the time limit (the pot is split). Every push to racers happens
 * here, inside the change that causes it.
 */
export class StreetRace {
  /** Racers by server id, with their character name. */
  readonly racers = new Map<number, string>();
  /** Players who got the invitation and have not joined. */
  readonly invited = new Set<number>();
  /** GO on the server clock; 0 while racers can join. */
  private startAt = 0;
  private over = false;
  private timer: ReturnType<typeof setTimeout>;
  private readonly purse: Purse;

  constructor(
    readonly o: RaceOptions,
    private readonly hooks: RaceHooks,
  ) {
    this.purse = new Purse(o.id, o.account, o.buyIn);
    this.timer = setTimeout(() => this.begin(), o.joinEndsAt - Date.now());
  }

  get open(): boolean {
    return this.startAt === 0 && !this.over;
  }

  invite(): InviteView {
    const { id, hostName, buyIn, start, joinEndsAt } = this.o;
    return { id, hostName, buyIn, start, joinEndsAt };
  }

  private view(): RaceView {
    return {
      ...this.invite(),
      host: this.o.host,
      finish: this.o.finish,
      pot: this.purse.pot,
      startAt: this.startAt,
      racers: [...this.racers].map(([id, name]) => ({ id, name })),
    };
  }

  /** Takes the buy-in and adds the racer; an error lang key when the race is closed, full or unaffordable. */
  join(source: number, name: string): string | null {
    if (!this.open) return "RACE_ERR_CLOSED";
    if (this.racers.size >= this.o.maxRacers) return "RACE_ERR_FULL";
    if (!this.purse.take(source)) return "RACE_ERR_MONEY";
    for (const other of this.racers.keys())
      emitNet(EVENTS.racer, other, { id: source, name }, this.purse.pot);
    this.racers.set(source, name);
    this.invited.delete(source);
    emitNet(EVENTS.state, source, this.view(), Date.now());
    aiLog("races", `joined race ${this.o.id}`, {
      source,
      metadata: { buyIn: this.o.buyIn, pot: this.purse.pot },
    });
    return null;
  }

  /**
   * The racer leaves (menu, character unload). Before the start the buy-in comes back and the host leaving cancels
   * the race; after the start it stays in the pot.
   */
  leave(source: number): void {
    if (!this.racers.has(source)) return;
    if (this.open && source === this.o.host)
      return this.cancel("RACE_CANCELLED_HOST");
    const refund = this.open;
    this.remove(source, refund);
    notify(
      source,
      refund
        ? Locale("RACE_LEFT_REFUND", money(this.o.buyIn))
        : Locale("RACE_LEFT_LOST"),
      refund ? "info" : "error",
    );
    if (this.racers.size === 0) this.end();
  }

  /** Ends the join time: racers away from the start or on foot go home with a refund, then the countdown runs. */
  begin(): string | null {
    if (!this.open) return "RACE_ERR_CLOSED";
    clearTimeout(this.timer);
    this.uninviteAll();
    for (const source of this.racers.keys()) {
      if (isNear(source, this.o.start, this.o.readyRadius) && driving(source))
        continue;
      this.remove(source, true);
      notify(source, Locale("RACE_NOT_READY", money(this.o.buyIn)), "error");
    }
    if (this.racers.size < 2) {
      this.cancel("RACE_CANCELLED_EMPTY");
      return null;
    }
    const now = Date.now();
    this.startAt = now + COUNTDOWN_MS;
    for (const source of this.racers.keys())
      emitNet(EVENTS.start, source, this.startAt, now);
    this.timer = setTimeout(() => this.timeout(), COUNTDOWN_MS + this.o.maxMs);
    aiLog("races", `race ${this.o.id} started`, {
      metadata: { racers: this.racers.size, pot: this.purse.pot },
    });
    maybeAlertPolice(
      this.o.alertChance,
      this.o.start,
      this.racers.size,
      this.racers.keys().next().value,
    );
    return null;
  }

  /** A racer reports the finish: checked on the server (position, driver, plausible time); the first one wins. */
  finish(source: number): boolean {
    if (!this.racers.has(source) || this.over || this.startAt === 0)
      return false;
    const elapsed = Date.now() - this.startAt;
    if (!finishHolds(source, this.o, elapsed)) return false;
    const pot = this.purse.takeAll();
    this.purse.pay(source, pot, "streetrace:won");
    const name = this.racers.get(source) ?? "";
    for (const racer of this.racers.keys())
      notify(
        racer,
        racer === source
          ? Locale("RACE_WON", money(pot))
          : Locale("RACE_LOST", name, money(pot)),
        racer === source ? "success" : "info",
        8000,
      );
    aiLog("races", `race ${this.o.id} won`, {
      source,
      metadata: { pot, ms: elapsed },
    });
    this.end();
    return true;
  }

  /** Every racer still in gets the buy-in back with the reason `key`; the race ends. */
  cancel(key: CancelReason): void {
    if (this.over) return;
    for (const source of this.racers.keys()) {
      this.purse.refund(source);
      notify(source, Locale(key, money(this.o.buyIn)), "info");
    }
    this.end();
  }

  /** Nobody reached the finish in time: the pot is split between the racers still in. */
  private timeout(): void {
    if (this.over) return;
    const share = Math.floor(this.purse.takeAll() / this.racers.size);
    for (const source of this.racers.keys()) {
      this.purse.pay(source, share, "streetrace:split");
      notify(source, Locale("RACE_TIMEOUT", money(share)), "info");
    }
    this.end();
  }

  private remove(source: number, refund: boolean): void {
    this.racers.delete(source);
    if (refund) this.purse.refund(source);
    this.hooks.out(source);
    emitNet(EVENTS.ended, source);
    for (const other of this.racers.keys())
      emitNet(EVENTS.racerLeft, other, source, this.purse.pot);
  }

  private uninviteAll(): void {
    for (const source of this.invited)
      emitNet(EVENTS.uninvite, source, this.o.id);
    this.invited.clear();
  }

  private end(): void {
    const forfeited = this.purse.takeAll();
    if (forfeited > 0)
      aiLog("races", `race ${this.o.id} ended with buy-ins forfeited`, {
        metadata: { forfeited },
      });
    this.over = true;
    clearTimeout(this.timer);
    this.uninviteAll();
    for (const source of this.racers.keys()) {
      this.hooks.out(source);
      emitNet(EVENTS.ended, source);
    }
    this.racers.clear();
    this.hooks.ended(this);
  }
}
