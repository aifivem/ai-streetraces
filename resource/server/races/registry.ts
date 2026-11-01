import {
  coordsOf,
  every,
  isNear,
  notify,
  online,
  playersNear,
} from "@aicore-fivem/lib/server";
import { Locale } from "common";
import { EVENTS, type Settings } from "common/race";
import { driving } from "./checks";
import { StreetRace } from "./race";
import type { RaceHooks } from "./raceState";
import { flatDistance } from "@aicore-fivem/lib/shared";

/** Extra metres around the invite radius a racer may stand from the start (joining, and when the join time ends). */
const READY_SLACK = 25;
/** How often running races sample their racers' server positions. */
const SAMPLE_MS = 2000;

/** Every street race and who is in which; one race per player. */
export class Races {
  private readonly byId = new Map<number, StreetRace>();
  private readonly byRacer = new Map<number, StreetRace>();
  private nextId = 1;
  /** One job for every race, on while any race exists. */
  private readonly sampler = every(
    SAMPLE_MS,
    () => {
      const now = Date.now();
      for (const race of this.byId.values()) race.sample(now);
    },
    { active: false, name: "race positions" },
  );
  private readonly hooks: RaceHooks = {
    out: (source) => this.byRacer.delete(source),
    ended: (race) => {
      this.byId.delete(race.o.id);
      if (this.byId.size === 0) this.sampler.set(false);
    },
  };

  constructor(private readonly settings: { readonly value: Settings }) {}

  of(source: number): StreetRace | undefined {
    return this.byRacer.get(source);
  }

  /** A race from the player's position to `finish`; the host pays first, then players nearby are invited. */
  create(
    source: number,
    buyIn: number,
    finish: { x: number; y: number },
  ): string | null {
    const s = this.settings.value;
    if (this.byRacer.has(source)) return "RACE_ERR_ALREADY";
    if (buyIn < s.minBuyIn || buyIn > s.maxBuyIn) return "RACE_ERR_BUYIN";
    if (!driving(source)) return "RACE_ERR_VEHICLE";
    const start = coordsOf(source);
    if (flatDistance(start, finish) < s.minDistance) return "RACE_ERR_SHORT";
    const race = new StreetRace(
      {
        id: this.nextId++,
        host: source,
        hostName: online.name(source),
        start,
        finish,
        buyIn,
        account: s.account,
        joinEndsAt: Date.now() + s.joinSeconds * 1000,
        maxMs: s.maxMinutes * 60_000,
        maxRacers: s.maxRacers,
        readyRadius: s.inviteRadius + READY_SLACK,
        alertChance: s.alertChance,
      },
      this.hooks,
    );
    const error = race.join(source, race.o.hostName);
    if (error) {
      // Nobody is in it yet: this only stops its timer.
      race.cancel("RACE_CANCELLED_EMPTY");
      return error;
    }
    this.byId.set(race.o.id, race);
    this.byRacer.set(source, race);
    this.sampler.set(true);
    const now = Date.now();
    for (const other of playersNear(source, s.inviteRadius)) {
      if (other === source || this.byRacer.has(other)) continue;
      if (!online.character(other)) continue;
      race.invited.add(other);
      emitNet(EVENTS.invite, other, race.invite(), now);
    }
    notify(
      source,
      Locale("RACE_CREATED", race.invited.size, s.joinSeconds),
      "success",
      6000,
    );
    return null;
  }

  /** Joins a race the player was invited to, at its start, as a driver. */
  join(source: number, id: number): string | null {
    if (this.byRacer.has(source)) return "RACE_ERR_ALREADY";
    const race = this.byId.get(id);
    if (!race?.open) return "RACE_ERR_CLOSED";
    if (!race.invited.has(source)) return "RACE_ERR_INVITE";
    if (!isNear(source, race.o.start, race.o.readyRadius))
      return "RACE_ERR_FAR";
    if (!driving(source)) return "RACE_ERR_VEHICLE";
    const error = race.join(source, online.name(source));
    if (error) return error;
    this.byRacer.set(source, race);
    return null;
  }

  /** The host ends the join time now. */
  begin(source: number): string | null {
    const race = this.byRacer.get(source);
    if (!race?.open || race.o.host !== source) return "RACE_ERR_HOST";
    if (race.racers.size < 2) return "RACE_ERR_ALONE";
    return race.begin();
  }

  /** The character is gone (drop, switch): out of its race (refund before the start), its invitations dropped. */
  unloaded(source: number): void {
    this.byRacer.get(source)?.leave(source);
    for (const race of this.byId.values()) race.invited.delete(source);
  }

  /** Resource stop: every race is cancelled with refunds. */
  cancelAll(): void {
    for (const race of this.byId.values()) race.cancel("RACE_CANCELLED_STOP");
  }
}
