export const focusHistoryRow = ({
  list,
  sha,
}: {
  readonly list: HTMLElement | null;
  readonly sha: string;
}) => {
  const row = list?.querySelector<HTMLElement>(`[data-history-row="${sha}"]`) ?? null;
  row?.focus({ preventScroll: false });
};
