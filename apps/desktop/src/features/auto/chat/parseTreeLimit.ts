const AMOUNT = /^\d{1,7}(?:\.\d{1,2})?$/;

type Params = {
  readonly draft: string;
};

export const parseTreeLimit = ({ draft }: Params): number | null => {
  const trimmed = draft.trim();
  if (!AMOUNT.test(trimmed)) {
    return null;
  }
  const amount = Number.parseFloat(trimmed);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};
