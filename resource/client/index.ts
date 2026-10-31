import { AdminWorld, onServerEvent, radial } from "@aicore-fivem/lib/client";
import { oneArg, readFinite, readId } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import {
  EVENTS,
  readInvite,
  readRaceView,
  readRacer,
  readSettings,
} from "common/race";
import { Invites } from "./invites";
import { isDriver, openMenu } from "./menu";
import { Racing } from "./racing";

const world = new AdminWorld(["settings"]);
const settings = world.view("settings", readSettings);
const racing = new Racing();
const invites = new Invites();

// One entry on whichever radial runs: shown while driving, invited or racing; the menu adapts to the state.
radial.add({
  id: "streetraces",
  label: Locale("RADIAL_LABEL"),
  icon: "flag-checkered",
  canShow: () => racing.current !== null || invites.size > 0 || isDriver(),
  onPressed: () => void openMenu(racing, invites, settings.value),
});
// The same menu from `/race` for servers without a radial menu.
onServerEvent(EVENTS.openMenu, () => {
  void openMenu(racing, invites, settings.value);
});

/** `[value, number]` events: a parsed value, then the server time or the pot. */
const pair =
  <T>(read: (v: unknown) => T | null) =>
  ([value, n]: unknown[]): [T, number] | null => {
    const parsed = read(value);
    const number = readFinite(n);
    return parsed === null || number === null ? null : [parsed, number];
  };

onServerEvent(EVENTS.state, { args: pair(readRaceView) }, (view, now) => {
  invites.remove(view.id);
  racing.snapshot(view, now);
  radial.refresh();
});
onServerEvent(EVENTS.racer, { args: pair(readRacer) }, (racer, pot) =>
  racing.racerJoined(racer, pot),
);
onServerEvent(EVENTS.racerLeft, { args: pair(readId) }, (id, pot) =>
  racing.racerLeft(id, pot),
);
onServerEvent(EVENTS.start, { args: pair(readFinite) }, (startAt, now) =>
  racing.started(startAt, now),
);
onServerEvent(EVENTS.ended, () => {
  racing.stop();
  radial.refresh();
});
onServerEvent(EVENTS.invite, { args: pair(readInvite) }, (invite, now) =>
  invites.add(invite, now),
);
onServerEvent(EVENTS.uninvite, { args: oneArg(readId) }, (id) =>
  invites.remove(id),
);
