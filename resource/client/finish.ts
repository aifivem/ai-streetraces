import {
  createBlip,
  every,
  groundZ,
  player,
  TickLoop,
  Zones,
} from "@aicore-fivem/lib/client";
import { Locale } from "common";
import { FINISH_RADIUS, flatDistance } from "common/race";

/** Distance from the finish at which its marker is drawn. */
const MARKER_RANGE = 300;

/**
 * The finish of the player's race: a route blip, a marker drawn near it (on the ground once its collision is
 * loaded) and, after GO, a tall zone (the waypoint has no height).
 */
export class Finish {
  private readonly point = { x: 0, y: 0, z: 0 };
  private blip = 0;
  private groundFound = false;
  private readonly zone = new Zones();
  private readonly draw = new TickLoop(
    () =>
      DrawMarker(
        1,
        this.point.x,
        this.point.y,
        this.point.z - 1,
        0,
        0,
        0,
        0,
        0,
        0,
        FINISH_RADIUS * 2,
        FINISH_RADIUS * 2,
        4,
        54,
        255,
        159,
        90,
        false,
        false,
        2,
        false,
        "",
        "",
        false,
      ),
    "finishMarker",
  );
  private readonly watch = every(1000, () => this.update(), {
    active: false,
    name: "finishWatch",
  });

  show(x: number, y: number): void {
    this.hide();
    this.point.x = x;
    this.point.y = y;
    this.point.z = player.coords().z;
    this.groundFound = false;
    this.blip = createBlip({
      coords: this.point,
      label: Locale("RACE_BLIP_FINISH"),
      sprite: 38,
      color: 5,
      scale: 1,
      shortRange: false,
    });
    SetBlipRoute(this.blip, true);
    this.watch.set(true);
  }

  /** Calls `onEnter` once when the player drives into the finish. */
  arm(onEnter: () => void): void {
    this.zone.clear();
    this.zone.add("finish", {
      shape: {
        type: "cylinder",
        center: { x: this.point.x, y: this.point.y, z: 0 },
        radius: FINISH_RADIUS,
        height: 3000,
      },
      interval: 100,
      onEnter: () => {
        this.zone.clear();
        onEnter();
      },
    });
  }

  hide(): void {
    this.zone.clear();
    this.draw.set(false);
    this.watch.set(false);
    if (this.blip) RemoveBlip(this.blip);
    this.blip = 0;
  }

  private update(): void {
    const at = player.coords();
    const near = flatDistance(at, this.point) < MARKER_RANGE;
    if (near && !this.groundFound) {
      const ground = groundZ(this.point.x, this.point.y);
      this.groundFound = ground !== null;
      this.point.z = ground ?? at.z;
    }
    this.draw.set(near);
  }
}
