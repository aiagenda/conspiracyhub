/** Re-exports — prefer @/lib/federalSpending for new code. */
export {
  fetchAllFederalAwards,
  fetchFederalAwardsByRecipient,
  fetchFederalSpendingForNode,
  formatFederalAwardUsd,
  type FederalAward,
  type FederalSpendingMode,
  type FederalSpendingResult,
} from "@/lib/federalSpending";
