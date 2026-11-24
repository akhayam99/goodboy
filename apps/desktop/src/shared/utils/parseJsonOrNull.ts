type Params = {
  readonly raw: string;
};

export const parseJsonOrNull = ({ raw }: Params): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
