import { AdminWorld } from "@aicore-fivem/lib/client";
import { readSettings } from "common/race";
import { Invites } from "./invites";
import { Racing } from "./racing";

const world = new AdminWorld(["settings"]);
export const settings = world.view("settings", readSettings);
export const racing = new Racing();
export const invites = new Invites();
