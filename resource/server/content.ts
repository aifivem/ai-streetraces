import { AdminPanel } from "@aicore-fivem/lib/server";
import { record } from "@aicore-fivem/lib/shared";
import { readSettings } from "common/race";
import { streetracesSchema } from "./schema";

const panel = new AdminPanel(streetracesSchema);
export const settings = panel.view("settings", readSettings);
panel.rule("settings", (_key, next) => {
  const s = record(next);
  return typeof s.minBuyIn === "number" &&
    typeof s.maxBuyIn === "number" &&
    s.minBuyIn > s.maxBuyIn
    ? "ADMIN_ERR_BUYIN_RANGE"
    : null;
});
