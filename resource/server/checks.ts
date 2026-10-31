import { aiLog, coordsOf, dispatch } from "@aicore-fivem/lib/server";
import type { Vec3 } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { FINISH_RADIUS, flatDistance, MAX_SPEED } from "common/race";

/** Slack on top of the finish radius for the server's position check (the client checks at the radius). */
const FINISH_SLACK = 10;

/** The player drives a vehicle (only drivers race). */
export function driving(source: number): boolean {
  const ped = GetPlayerPed(String(source));
  const vehicle = GetVehiclePedIsIn(ped, false);
  return vehicle !== 0 && GetPedInVehicleSeat(vehicle, -1) === ped;
}

/**
 * A finish report holds up: the racer drives, stands at the finish (server position) and took at least the straight
 * line at `MAX_SPEED` since GO. An impossible time is logged (teleport or a cheat).
 */
export function finishHolds(
  source: number,
  race: { id: number; start: Vec3; finish: { x: number; y: number } },
  elapsed: number,
): boolean {
  if (
    elapsed < 0 ||
    flatDistance(coordsOf(source), race.finish) >
      FINISH_RADIUS + FINISH_SLACK ||
    !driving(source)
  )
    return false;
  if (elapsed >= (flatDistance(race.start, race.finish) / MAX_SPEED) * 1000)
    return true;
  aiLog("races", `implausible finish in race ${race.id}`, {
    level: "warn",
    source,
    metadata: { ms: elapsed },
  });
  return false;
}

/** Rolls the panel's chance and alerts the police at the start line; `suspect` is described by the alert system. */
export function maybeAlertPolice(
  chance: number,
  start: Vec3,
  racers: number,
  suspect: number | undefined,
): void {
  if (Math.random() * 100 >= chance) return;
  dispatch.alert({
    title: Locale("ALERT_TITLE"),
    message: Locale("ALERT_MESSAGE", racers),
    coords: start,
    source: suspect,
    icon: "flag-checkered",
  });
}
