type Params = {
  readonly raw: string | null;
};

const isPort = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535;

export const parsePortList = ({ raw }: Params): ReadonlyArray<number> => {
  if (raw === null) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const ports = new Set<number>();
  for (const item of parsed) {
    if (isPort(item)) {
      ports.add(item);
    }
  }
  return [...ports].sort((a, b) => a - b);
};
