type Params = {
  readonly raw: string | null;
};

type PortRecord = Readonly<Record<string, unknown>>;

const parseList = ({ raw }: Params): ReadonlyArray<unknown> => {
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const portRecordsOf = ({ raw }: Params): ReadonlyArray<PortRecord> =>
  parseList({ raw }).flatMap((item) =>
    typeof item === 'object' && item !== null ? [Object.fromEntries(Object.entries(item))] : [],
  );
