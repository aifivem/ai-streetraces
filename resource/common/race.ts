import {
  int,
  readFinite,
  readId,
  readText,
  record,
  str,
  type Vec3,
} from "@aicore-fivem/lib/shared";

/** ai-streetraces' contracts and panel content. No natives. */

export const EVENTS = {
  /** Callback: (buyIn, finishX, finishY) -> { ok } creates a race from the player's position to the finish. */
  create: "ai-streetraces:create",
  /** Callback: (raceId) -> { ok } joins a race the player was invited to (pays the buy-in). */
  join: "ai-streetraces:join",
  /** Callback: () -> { ok } leaves the race; the host leaving a race that has not started cancels it. */
  leave: "ai-streetraces:leave",
  /** Callback: () -> { ok } the host ends the join time now. */
  begin: "ai-streetraces:begin",
  /** Callback: () -> { ok } the racer reached the finish. */
  finish: "ai-streetraces:finish",
  /** Server -> racer: (RaceView, serverNow) snapshot of the race the player is in. */
  state: "ai-streetraces:client:state",
  /** Server -> racers: (RacerView, pot) a racer joined. */
  racer: "ai-streetraces:client:racer",
  /** Server -> racers: (racerId, pot) a racer left. */
  racerLeft: "ai-streetraces:client:racerLeft",
  /** Server -> racers: (startAt, serverNow) the countdown runs; GO at startAt (server clock). */
  start: "ai-streetraces:client:start",
  /** Server -> racer: () the race is over for this player. */
  ended: "ai-streetraces:client:ended",
  /** Server -> players near a new race: (InviteView, serverNow). */
  invite: "ai-streetraces:client:invite",
  /** Server -> invited players: (raceId) the race no longer takes racers. */
  uninvite: "ai-streetraces:client:uninvite",
} as const;

/** Countdown between the end of the join time and GO. */
export const COUNTDOWN_MS = 5000;
/** The finish is a circle of this radius around the waypoint (x, y; any height). */
export const FINISH_RADIUS = 12;
/** Fastest plausible average speed (m/s, 360 km/h) over the straight line start -> finish. */
export const MAX_SPEED = 100;
/** Map coordinates beyond this are refused. */
export const MAP_LIMIT = 10_000;

export interface RacerView {
  id: number;
  name: string;
}

export interface RaceView {
  id: number;
  /** Server id of the host (creator). */
  host: number;
  hostName: string;
  start: Vec3;
  finish: { x: number; y: number };
  buyIn: number;
  pot: number;
  /** Server clock: the join time ends (the countdown starts) then. */
  joinEndsAt: number;
  /** Server clock: GO; 0 while racers can still join. */
  startAt: number;
  racers: RacerView[];
}

export interface InviteView {
  id: number;
  hostName: string;
  buyIn: number;
  start: Vec3;
  joinEndsAt: number;
}

export interface Settings {
  account: string;
  minBuyIn: number;
  maxBuyIn: number;
  joinSeconds: number;
  maxRacers: number;
  inviteRadius: number;
  minDistance: number;
  maxMinutes: number;
  /** Chance (%) that a race start alerts the police. */
  alertChance: number;
}

export const DEFAULT_SETTINGS: Settings = {
  account: "cash",
  minBuyIn: 100,
  maxBuyIn: 15000,
  joinSeconds: 45,
  maxRacers: 8,
  inviteRadius: 60,
  minDistance: 500,
  maxMinutes: 10,
  alertChance: 25,
};

export function readSettings(raw: unknown): Settings {
  const s = record(raw);
  const d = DEFAULT_SETTINGS;
  const minBuyIn = int(s.minBuyIn, d.minBuyIn, 0, 10_000_000);
  return {
    account: str(s.account, d.account, 32),
    minBuyIn,
    maxBuyIn: int(s.maxBuyIn, d.maxBuyIn, minBuyIn, 10_000_000),
    joinSeconds: int(s.joinSeconds, d.joinSeconds, 15, 300),
    maxRacers: int(s.maxRacers, d.maxRacers, 2, 16),
    inviteRadius: int(s.inviteRadius, d.inviteRadius, 10, 400),
    minDistance: int(s.minDistance, d.minDistance, 100, 10_000),
    maxMinutes: int(s.maxMinutes, d.maxMinutes, 1, 60),
    alertChance: int(s.alertChance, d.alertChance, 0, 100),
  };
}

/** Distance on the ground plane (the finish has no height). */
export const flatDistance = (
  a: { x: number; y: number },
  b: { x: number; y: number },
): number => Math.hypot(a.x - b.x, a.y - b.y);

/** A map coordinate from client input, else null. */
export function readCoord(value: unknown): number | null {
  const v = readFinite(value);
  return v !== null && Math.abs(v) < MAP_LIMIT ? v : null;
}

const readPoint = (value: unknown): Vec3 | null => {
  const v = record(value);
  const [x, y, z] = [readFinite(v.x), readFinite(v.y), readFinite(v.z)];
  return x !== null && y !== null && z !== null ? { x, y, z } : null;
};

export function readRacer(value: unknown): RacerView | null {
  const v = record(value);
  const id = readId(v.id);
  const name = readText(v.name, 64);
  return id === null || name === null ? null : { id, name };
}

export function readInvite(value: unknown): InviteView | null {
  const v = record(value);
  const id = readId(v.id);
  const hostName = readText(v.hostName, 64);
  const buyIn = readFinite(v.buyIn);
  const start = readPoint(v.start);
  const joinEndsAt = readFinite(v.joinEndsAt);
  return id === null ||
    hostName === null ||
    buyIn === null ||
    start === null ||
    joinEndsAt === null
    ? null
    : { id, hostName, buyIn, start, joinEndsAt };
}

export function readRaceView(value: unknown): RaceView | null {
  const v = record(value);
  const invite = readInvite(v);
  const host = readId(v.host);
  const f = record(v.finish);
  const fx = readFinite(f.x);
  const fy = readFinite(f.y);
  const pot = readFinite(v.pot);
  const startAt = readFinite(v.startAt);
  if (
    !invite ||
    host === null ||
    fx === null ||
    fy === null ||
    pot === null ||
    startAt === null ||
    !Array.isArray(v.racers)
  )
    return null;
  const racers: RacerView[] = [];
  for (const row of v.racers) {
    const racer = readRacer(row);
    if (racer) racers.push(racer);
  }
  return {
    ...invite,
    host,
    finish: { x: fx, y: fy },
    pot,
    startAt,
    racers,
  };
}
