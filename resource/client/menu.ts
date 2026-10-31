import {
  cache,
  callAction,
  input,
  menu,
  notify,
  player,
} from "@aicore-fivem/lib/client";
import type { MenuItem } from "@aicore-fivem/shared";
import { groupDigits } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { EVENTS, flatDistance, type Settings } from "common/race";
import type { Invites } from "./invites";
import type { Racing } from "./racing";

/** GTA's waypoint blip sprite. */
const WAYPOINT_SPRITE = 8;

/** The map waypoint (x, y), or null. */
function waypoint(): { x: number; y: number } | null {
  const blip = GetFirstBlipInfoId(WAYPOINT_SPRITE);
  if (!DoesBlipExist(blip)) return null;
  const [x = 0, y = 0] = GetBlipInfoIdCoord(blip);
  return { x, y };
}

export const isDriver = (): boolean =>
  cache.vehicle !== false && cache.seat === -1;

const secondsLeft = (localTime: number): number =>
  Math.max(0, Math.ceil((localTime - Date.now()) / 1000));

/** Asks for the buy-in and creates a race to the waypoint; the server checks everything again. */
async function createRace(settings: Settings): Promise<void> {
  const finish = waypoint();
  if (!finish) return notify(Locale("RACE_ERR_WAYPOINT"), "error");
  if (!isDriver()) return notify(Locale("RACE_ERR_VEHICLE"), "error");
  if (flatDistance(player.coords(), finish) < settings.minDistance)
    return notify(Locale("RACE_ERR_SHORT"), "error");
  const { minBuyIn: min, maxBuyIn: max } = settings;
  const values = await input({
    title: Locale("RACE_CREATE_TITLE"),
    fields: [
      {
        name: "buyIn",
        label: Locale("RACE_F_BUYIN", groupDigits(min), groupDigits(max)),
        type: "number",
        min,
        max,
        placeholder: String(min),
      },
    ],
    confirm: Locale("RACE_CREATE_CONFIRM"),
  });
  const buyIn = Number(values?.buyIn);
  if (!values || !Number.isInteger(buyIn)) return;
  await callAction(EVENTS.create, [buyIn, finish.x, finish.y], {
    fallback: "RACE_ERR_BUYIN",
  });
}

/** The street race menu: what the player can do now (create, join an invitation, start, leave). */
export async function openMenu(
  racing: Racing,
  invites: Invites,
  settings: Settings,
): Promise<void> {
  const race = racing.current;
  const items: MenuItem[] = [];
  if (!race) {
    items.push({
      id: "create",
      label: Locale("RACE_MENU_CREATE"),
      description: Locale("RACE_MENU_CREATE_DESC", settings.minDistance),
      icon: "road",
      disabled: !isDriver(),
    });
    for (const { view, endsAt } of invites.values())
      items.push({
        id: `join:${view.id}`,
        label: Locale("RACE_MENU_JOIN", view.hostName),
        description: Locale(
          "RACE_MENU_JOIN_DESC",
          groupDigits(view.buyIn),
          secondsLeft(endsAt),
        ),
        icon: "users",
      });
  } else {
    const lobby = race.startAt === 0;
    items.push({
      id: "info",
      label: Locale(
        "RACE_MENU_INFO",
        race.racers.length,
        groupDigits(race.pot),
      ),
      description: lobby
        ? Locale(
            "RACE_MENU_INFO_LOBBY",
            secondsLeft(racing.local(race.joinEndsAt)),
          )
        : Locale("RACE_MENU_INFO_RUNNING"),
      icon: "money-bill-wave",
      disabled: true,
    });
    const host = race.host === cache.serverId;
    if (lobby && host)
      items.push({
        id: "start",
        label: Locale("RACE_MENU_START"),
        icon: "flag-checkered",
        disabled: race.racers.length < 2,
      });
    items.push({
      id: "leave",
      label: Locale(
        !lobby
          ? "RACE_MENU_GIVE_UP"
          : host
            ? "RACE_MENU_CANCEL"
            : "RACE_MENU_LEAVE",
      ),
      icon: "xmark",
    });
  }
  const pick = await menu({ title: Locale("RACE_MENU_TITLE"), items });
  if (pick === "create") return createRace(settings);
  if (pick === "start")
    return void (await callAction(EVENTS.begin, [], {
      fallback: "RACE_ERR_HOST",
    }));
  if (pick === "leave")
    return void (await callAction(EVENTS.leave, [], {
      fallback: "RACE_ERR_NONE",
    }));
  if (pick?.startsWith("join:"))
    await callAction(EVENTS.join, [Number(pick.slice(5))], {
      fallback: "RACE_ERR_CLOSED",
    });
}
