# ai-streetraces

Ad-hoc point-to-point street races: a driver sets a map waypoint, picks a buy-in, drivers nearby are invited, the first racer at the finish takes the pot. Depends on ai-core (money, characters, menu, input, notifications, radial and dispatch layers); no database, no NUI.

## Decisions

- Port of qb-streetraces / qbx_streetraces, redesigned: the server owns everything (race state, start position = the host's server position, finish check, money); the client only reads the waypoint and reports reaching the finish. It is the only race script (owner decision: no lap / track races) and has no stored track.
- Two ways in, one menu: a lib `radial` item ("Street race", shown while driving, invited or racing) and `/race` (owner decision: for servers without a radial menu; the server sends `openMenu`). The context menu shows only what the player can do now (create to waypoint, join an invitation, start now, cancel / leave / give up), where QB needs four commands and a typed amount.
- Invitations, not a join prompt at the start line: on create the server sends one invite to drivers with a character within `inviteRadius` (lib `playersNear`); joining needs that invite, the start line within `inviteRadius + 25 m` and the driver seat. Invites expire on the client clock at the end of the join time and are withdrawn (`uninvite`) when the race starts early or is cancelled.
- Phases: join time (`joinSeconds`, the host may start earlier once two racers are in), a fixed 5 s countdown (`COUNTDOWN_MS`, vehicle frozen on the client), then running until a winner or `maxMinutes`. When the join time ends, racers away from the start or not driving are sent home with a refund; under two racers left cancels the race.
- Money: the buy-in is taken on join (`RemoveMoney` on the panel account, fixed per race at creation) and held as an in-memory pot (`server/purse.ts`). Before the start every exit refunds (leave, character unload, host cancel or host leaving, too few racers, resource stop). After the start leaving or dropping forfeits the buy-in into the pot; the first accepted finish takes the whole pot once (`takeAll` before paying); the time limit splits the pot evenly between racers still in; a resource stop refunds each remaining racer their buy-in. Buy-ins of racers who all left a running race are lost (logged).
- Finish check on the server: the racer drives, stands within `FINISH_RADIUS + 10 m` (flat: the waypoint has no height) of the finish, and took at least the straight start-finish line at 100 m/s since GO (an impossible time is logged as a warning).
- Police alert: when the countdown starts, `alertChance` % rolls a lib `dispatch.alert` at the start line, describing the first racer.
- Settings are one panel file (`sync: "all"`): the client needs the buy-in limits and the minimum distance for the create dialog.

## Contracts

- Callbacks and events: `resource/common/race.ts` (`create`, `join`, `leave`, `begin`, `finish`; server -> racer `state` snapshot, `racer` / `racerLeft` deltas with the pot, `start` with the server time, `ended`; server -> nearby players `invite` / `uninvite`).
- Panel file `data/settings.json`; log channel `races`.

## Pitfalls

- Racers leave through `onCharacter`'s `unloaded`, not a `PlayerMap` drop: ai-core emits the unload before it drops the character, so a lobby refund still reaches the account; on `playerDropped` the character may already be gone and `AddMoney` would fail.
- A source can be reused by a new player inside the join time: invitations are keyed by source and cleared on unload, so a newcomer never inherits one.
- Race and invite expiry run on the client clock with the server offset taken from each `state` / `start` / `invite` (`serverNow` argument).

## Entry points

- Race lifecycle, money and pushes: `resource/server/race.ts` (`StreetRace`), registry and the create / join checks `resource/server/races.ts`, finish and police checks `resource/server/checks.ts`, callbacks `resource/server/index.ts`, panel `resource/server/schema.ts`.
- Client: radial and event wiring `resource/client/index.ts`, the menu and create dialog `client/menu.ts`, the race mirror and countdown `client/racing.ts`, finish blip / marker / zone `client/finish.ts`.
