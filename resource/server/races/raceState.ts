import { aiLog, notify } from "@aicore-fivem/lib/server";
import { groupDigits, type Vec3 } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, type InviteView, type RaceView } from "common/race";
import type { Sample } from "./checks";
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
  ended(race: RaceState): void;
}

type CancelReason =
  "RACE_CANCELLED_HOST" | "RACE_CANCELLED_EMPTY" | "RACE_CANCELLED_STOP";

export const money = (amount: number): string => groupDigits(amount);

/**
 * What a street race holds (racers, invitations, position samples, the clock, the pot) and the bookkeeping every phase
 * shares: the views pushed to players, taking a racer out, cancelling and ending. The flow is `StreetRace`.
 */
export abstract class RaceState {
  /** Racers by server id, with their character name. */
  readonly racers = new Map<number, string>();
  /** Players who got the invitation and have not joined. */
  readonly invited = new Set<number>();
  /** Each racer's last server position since the countdown (teleport check). */
  protected readonly samples = new Map<number, Sample>();
  /** GO on the server clock; 0 while racers can join. */
  protected startAt = 0;
  protected over = false;
  protected timer: ReturnType<typeof setTimeout>;
  protected readonly purse: Purse;

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

  /** The countdown or the race runs (positions are sampled). */
  get running(): boolean {
    return this.startAt !== 0 && !this.over;
  }

  invite(): InviteView {
    const { id, hostName, buyIn, start, joinEndsAt } = this.o;
    return { id, hostName, buyIn, start, joinEndsAt };
  }

  protected view(): RaceView {
    return {
      ...this.invite(),
      host: this.o.host,
      finish: this.o.finish,
      pot: this.purse.pot,
      startAt: this.startAt,
      racers: [...this.racers].map(([id, name]) => ({ id, name })),
    };
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

  protected remove(source: number, refund: boolean): void {
    this.racers.delete(source);
    this.samples.delete(source);
    if (refund) this.purse.refund(source);
    this.hooks.out(source);
    emitNet(EVENTS.ended, source);
    for (const other of this.racers.keys())
      emitNet(EVENTS.racerLeft, other, source, this.purse.pot);
  }

  protected uninviteAll(): void {
    for (const source of this.invited)
      emitNet(EVENTS.uninvite, source, this.o.id);
    this.invited.clear();
  }

  protected end(): void {
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
    this.samples.clear();
    this.hooks.ended(this);
  }

  /** Ends the join time (the constructor's timer runs it). */
  abstract begin(): string | null;
}
