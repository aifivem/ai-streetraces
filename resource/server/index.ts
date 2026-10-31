import {
  AdminPanel,
  aiLogChannels,
  hasCharacter,
  onCharacter,
  onClientCallback,
} from "@aicore-fivem/lib/server";
import {
  fail,
  oneArg,
  readId,
  readInt,
  record,
} from "@aicore-fivem/lib/shared";
import { ResourceName } from "common";
import { EVENTS, readCoord, readSettings } from "common/race";
import { Races } from "./races";
import { streetracesSchema } from "./schema";

const panel = new AdminPanel(streetracesSchema);
const settings = panel.view("settings", readSettings);
panel.rule("settings", (_key, next) => {
  const s = record(next);
  return typeof s.minBuyIn === "number" &&
    typeof s.maxBuyIn === "number" &&
    s.minBuyIn > s.maxBuyIn
    ? "ADMIN_ERR_BUYIN_RANGE"
    : null;
});
aiLogChannels({ races: {} });

const races = new Races(settings);

// The unload event comes before ai-core drops the character, so a refund still reaches the account.
onCharacter({ unloaded: (source) => races.unloaded(source) });
on("onResourceStop", (name: string) => {
  if (name === ResourceName) races.cancelAll();
});

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
