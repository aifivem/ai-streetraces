import { notify, radial } from "@aicore-fivem/lib/client";
import { groupDigits } from "@aicore-fivem/lib/shared";
import { Locale } from "common";
import type { InviteView } from "common/race";

interface Invite {
  view: InviteView;
  /** Local clock: the join time ends. */
  endsAt: number;
  timer: ReturnType<typeof setTimeout>;
}

/** Races the player was invited to; each expires on the local clock when its join time ends. */
export class Invites {
  private readonly list = new Map<number, Invite>();

  get size(): number {
    return this.list.size;
  }

  values(): IterableIterator<Invite> {
    return this.list.values();
  }

  add(view: InviteView, serverNow: number): void {
    const ms = view.joinEndsAt - serverNow;
    if (ms <= 0) return;
    this.remove(view.id);
    this.list.set(view.id, {
      view,
      endsAt: Date.now() + ms,
      timer: setTimeout(() => this.remove(view.id), ms),
    });
    notify(
      Locale(
        "RACE_INVITED",
        view.hostName,
        groupDigits(view.buyIn),
        Math.ceil(ms / 1000),
      ),
      "info",
      8000,
    );
    radial.refresh();
  }

  remove(id: number): void {
    const invite = this.list.get(id);
    if (!invite) return;
    clearTimeout(invite.timer);
    this.list.delete(id);
    radial.refresh();
  }
}
