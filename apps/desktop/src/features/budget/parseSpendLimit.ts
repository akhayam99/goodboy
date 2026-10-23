export const parseSpendLimit = (draft: string): number | null => {
  const normalized = draft.trim().replace(',', '.');
  if (normalized === '') {
    return null;
  }
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};
