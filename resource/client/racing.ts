import {
  cache,
  callAction,
  drivenVehicle,
  notify,
} from "@aicore-fivem/lib/client";
import { groupDigits, ServerClock } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import {
  COUNTDOWN_MS,
  EVENTS,
  type RaceView,
  type RacerView,
} from "common/race";
import { Finish } from "./finish";

/**
 * The race the player is in, mirrored from the server's snapshot and deltas: the finish shown from the start, the
 * countdown on the local clock (vehicle held still), then the finish zone; the server checks the finish.
 */
export class Racing {
  private race: RaceView | null = null;
  /** The server clock, synced at the snapshot and the start. */
  private readonly clock = new ServerClock();
  private frozen = 0;
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private readonly finish = new Finish();

  get current(): RaceView | null {
    return this.race;
  }

  /** Local time of a server time. */
  local(serverTime: number): number {
    return this.clock.toLocal(serverTime);
  }

  snapshot(view: RaceView, serverNow: number): void {
    this.stop();
    this.race = view;
    this.clock.sync(serverNow);
    this.finish.show(view.finish.x, view.finish.y);
    // The host already got the server's "created" note.
    if (view.host === cache.serverId) return;
    const seconds = Math.ceil((view.joinEndsAt - serverNow) / 1000);
    notify(
      Locale("RACE_JOINED", view.hostName, groupDigits(view.pot), seconds),
      "info",
      6000,
    );
  }

  racerJoined(racer: RacerView, pot: number): void {
    const race = this.race;
    if (!race) return;
    race.racers = [...race.racers.filter((r) => r.id !== racer.id), racer];
    race.pot = pot;
    notify(
      Locale(
        "RACE_RACER_JOINED",
        racer.name,
        race.racers.length,
        groupDigits(pot),
      ),
      "info",
    );
  }

  racerLeft(id: number, pot: number): void {
    const race = this.race;
    if (!race) return;
    const gone = race.racers.find((r) => r.id === id);
    race.racers = race.racers.filter((r) => r.id !== id);
    race.pot = pot;
    if (gone)
      notify(Locale("RACE_RACER_LEFT", gone.name, race.racers.length), "info");
  }

  /** The countdown: the vehicle is held still until GO at `startAt` (server clock). */
  started(startAt: number, serverNow: number): void {
    const race = this.race;
    if (!race) return;
    race.startAt = startAt;
    this.clock.sync(serverNow);
    const startsIn = Math.max(0, startAt - serverNow);
    const vehicle = drivenVehicle();
    if (vehicle !== false) {
      this.frozen = vehicle;
      FreezeEntityPosition(this.frozen, true);
    }
    for (let s = Math.floor(COUNTDOWN_MS / 1000); s >= 1; s--)
      this.later(startsIn - s * 1000, () => {
        PlaySoundFrontend(-1, "3_2_1", "HUD_MINI_GAME_SOUNDSET", true);
        notify(String(s), "info", 900);
      });
    this.later(startsIn, () => {
      this.unfreeze();
      PlaySoundFrontend(-1, "GO", "HUD_MINI_GAME_SOUNDSET", true);
      notify(Locale("RACE_GO"), "success", 1500);
      this.finish.arm(() => void this.reachFinish());
    });
  }

  stop(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
    this.unfreeze();
    this.finish.hide();
    this.race = null;
  }

  private later(ms: number, fn: () => void): void {
    if (ms >= 0) this.timers.push(setTimeout(fn, ms));
  }

  private unfreeze(): void {
    if (this.frozen) FreezeEntityPosition(this.frozen, false);
    this.frozen = 0;
  }

  private async reachFinish(): Promise<void> {
    const done = await callAction(EVENTS.finish, [], {
      fallback: "RACE_ERR_FINISH",
      silent: true,
    });
    // Refused (on foot, too soon): try again shortly while still racing; a win ends the race from the server.
    if (!done && this.race)
      this.later(1000, () => this.finish.arm(() => void this.reachFinish()));
  }
}
