import { aiLog, isNear, notify } from "@aicore-fivem/lib/server";
import { Locale } from "common";
import { COUNTDOWN_MS, EVENTS } from "common/race";
import {
  driving,
  finishHolds,
  maybeAlertPolice,
  sampleHolds,
  sampleOf,
} from "./checks";
import { money, RaceState } from "./raceState";

/**
 * One street race: a lobby until the join time ends (or the host starts it), a countdown, then running until the
 * first racer reaches the finish (takes the pot) or the time limit (the pot is split). Every push to racers happens
 * here, inside the change that causes it.
 */
export class StreetRace extends RaceState {
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
      this.samples.set(source, sampleOf(source, now));
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

  /** Checks every racer's move since the last sample (the registry's 2 s job); a teleport disqualifies. */
  sample(now: number): void {
    if (!this.running) return;
    for (const source of this.racers.keys()) this.moveHolds(source, now);
  }

  /** The racer's move since his last sample is drivable; else he is disqualified and false. */
  private moveHolds(source: number, now: number): boolean {
    const last = this.samples.get(source);
    const next = last ? sampleHolds(source, last, now) : sampleOf(source, now);
    if (next) {
      this.samples.set(source, next);
      return true;
    }
    aiLog("races", `disqualified from race ${this.o.id}: moved too fast`, {
      level: "warn",
      source,
      metadata: { from: last, to: sampleOf(source, now) },
    });
    this.remove(source, false);
    notify(source, Locale("RACE_DISQUALIFIED"), "error");
    if (this.racers.size === 0) this.end();
    return false;
  }

  /** A racer reports the finish: checked on the server (steady moves, position, driver, plausible time); the first one wins. */
  finish(source: number): boolean {
    if (!this.racers.has(source) || this.over || this.startAt === 0)
      return false;
    const now = Date.now();
    if (!this.moveHolds(source, now)) return false;
    const elapsed = now - this.startAt;
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
}
