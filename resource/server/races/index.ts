import {
  addCommand,
  aiLogChannels,
  hasCharacter,
  onCharacter,
  onClientCallback,
  onStop,
} from "@aicore-fivem/lib/server";
import { fail, oneArg, readId, readInt } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, readCoord } from "common/race";
import { settings } from "../content";
import { Races } from "./registry";

aiLogChannels({ races: {} });

const races = new Races(settings);

// The unload event comes before ai-core drops the character, so a refund still reaches the account.
onCharacter({ unloaded: (source) => races.unloaded(source) });
onStop(() => races.cancelAll());

const answer = (error: string | null) => (error ? fail(error) : { ok: true });

onClientCallback(
  EVENTS.create,
  {
    args: ([buyIn, x, y]): [number, number, number] | null => {
      const amount = readInt(buyIn, 0, 10_000_000);
      const fx = readCoord(x);
      const fy = readCoord(y);
      return amount === null || fx === null || fy === null
        ? null
        : [amount, fx, fy];
    },
    guards: [hasCharacter()],
    lock: true,
    // Each create asks who is near.
    rate: { count: 2, windowMs: 5000 },
  },
  (source, buyIn, x, y) => answer(races.create(source, buyIn, { x, y })),
);

onClientCallback(
  EVENTS.join,
  { args: oneArg(readId), guards: [hasCharacter()], lock: true },
  (source, id) => answer(races.join(source, id)),
);

onClientCallback(
  EVENTS.leave,
  (source) => {
    const race = races.of(source);
    if (!race) return fail("RACE_ERR_NONE");
    race.leave(source);
    return { ok: true };
  },
  { lock: true },
);

onClientCallback(EVENTS.begin, (source) => answer(races.begin(source)), {
  lock: true,
});

onClientCallback(
  EVENTS.finish,
  (source) =>
    races.of(source)?.finish(source) ? { ok: true } : fail("RACE_ERR_FINISH"),
  { lock: true, rate: { count: 4, windowMs: 2000 } },
);

// The race menu for servers without a radial menu (the radial entry opens the same menu).
addCommand("race", { help: Locale("COMMAND_RACE_HELP") }, (source) => {
  if (source > 0) emitNet(EVENTS.openMenu, source);
});
