const MAX_ROWS = 5;

const RECORD_HEADER_CUTS: ReadonlyArray<string> = ['record.copyKey', 'record.refresh'];

type Params = {
  readonly actions: ReadonlyArray<{ readonly id: string }>;
};

export const recordHeaderOnlyOf = ({ actions }: Params): ReadonlyArray<string> => {
  const ids = actions.map((action) => action.id);
  const cut = RECORD_HEADER_CUTS.filter((id) => ids.includes(id)).slice(
    0,
    Math.max(0, ids.length - MAX_ROWS),
  );
  return ids.filter((id) => !cut.includes(id));
};
