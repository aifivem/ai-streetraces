import { aiLog, coordsOf, dispatch } from "@aicore-fivem/lib/server";
import type { Vec3 } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import { FINISH_RADIUS, flatDistance, MAX_SPEED } from "common/race";

/** Slack on top of the finish radius for the server's position check (the client checks at the radius). */
const FINISH_SLACK = 10;
/** Fastest plausible speed (m/s, 430 km/h) between two server position samples of a racer. */
const MAX_SEGMENT_SPEED = 120;
/** Metres allowed on top of that per segment (position sync jitter). */
const SEGMENT_SLACK = 30;

/** A racer's last server position sample. */
export interface Sample {
  x: number;
  y: number;
  at: number;
}

/** The racer's position now, or null when he moved faster than a vehicle can since `last` (teleport). */
export function sampleHolds(
  source: number,
  last: Sample,
  now: number,
): Sample | null {
  const p = coordsOf(source);
  const limit = (MAX_SEGMENT_SPEED * (now - last.at)) / 1000 + SEGMENT_SLACK;
  return flatDistance(p, last) <= limit ? { x: p.x, y: p.y, at: now } : null;
}

/** The racer's position sample now. */
export function sampleOf(source: number, now: number): Sample {
  const p = coordsOf(source);
  return { x: p.x, y: p.y, at: now };
}

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
