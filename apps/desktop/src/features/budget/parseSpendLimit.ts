export const parseSpendLimit = (draft: string): number | null => {
  const amount = Number.parseFloat(draft.trim());
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};
