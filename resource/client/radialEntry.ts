import { onServerEvent, radial } from "@aicore-fivem/lib/client";
import { Locale } from "common";
import { EVENTS } from "common/race";
import { isDriver, openMenu } from "./menu";
import { invites, racing, settings } from "./state";

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
