import { aiLog, resourceExport } from "@aicore-fivem/lib/server";

const core = resourceExport("ai-core");

/**
 * One race's money: buy-ins go out of the players' accounts into `pot` (held in memory, never a shared account),
 * refunds and payouts go back through ai-core. The account is fixed at creation so a panel change cannot split
 * one race's payments.
 */
export class Purse {
  pot = 0;

  constructor(
    private readonly race: number,
    private readonly account: string,
    readonly buyIn: number,
  ) {}

  /** Takes the buy-in; false when the player cannot pay. */
  take(source: number): boolean {
    if (
      this.buyIn > 0 &&
      !core.RemoveMoney(
        source,
        this.account,
        this.buyIn,
        `streetrace:${this.race}`,
      )
    )
      return false;
    this.pot += this.buyIn;
    return true;
  }

  /** Gives the buy-in back out of the pot. */
  refund(source: number): void {
    this.pot -= this.buyIn;
    this.pay(source, this.buyIn, "streetrace:refund");
  }

  /** Pays `amount` (already taken out of the pot by the caller). */
  pay(source: number, amount: number, reason: string): void {
    if (amount > 0 && !core.AddMoney(source, this.account, amount, reason))
      aiLog("races", `payment of race ${this.race} failed`, {
        level: "error",
        source,
        metadata: { amount, reason },
      });
  }

  /** Empties the pot and answers what was in it. */
  takeAll(): number {
    const pot = this.pot;
    this.pot = 0;
    return pot;
  }
}
