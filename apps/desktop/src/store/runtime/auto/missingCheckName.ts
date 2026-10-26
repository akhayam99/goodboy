import type { ProjectScript } from '@goodboy/types';

type Params = {
  readonly pinId: string;
  readonly saved: ReadonlyArray<ProjectScript>;
};

const UNKNOWN_SCRIPT = 'a ticked script';

const partsOf = ({ pinId }: Pick<Params, 'pinId'>): ReadonlyArray<string> | null => {
  try {
    const parsed: unknown = JSON.parse(pinId);
    if (!Array.isArray(parsed) || parsed.length !== 3) {
      return null;
    }
    const parts = parsed.filter((entry): entry is string => typeof entry === 'string');
    return parts.length === 3 ? parts : null;
  } catch {
    return null;
  }
};

export const missingCheckName = ({ pinId, saved }: Params): string => {
  const parts = partsOf({ pinId });
  if (parts === null) {
    return UNKNOWN_SCRIPT;
  }
  const [source, relDir, name] = parts;
  if (source === 'saved') {
    return saved.find((script) => script.id === name)?.name ?? UNKNOWN_SCRIPT;
  }
  if (name === undefined || name === '') {
    return UNKNOWN_SCRIPT;
  }
  return relDir === undefined || relDir === '' ? name : `${relDir}/${name}`;
};
