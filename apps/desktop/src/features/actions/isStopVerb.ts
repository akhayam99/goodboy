type Params = {
  readonly verb: string;
};

const STOP_VERBS: ReadonlySet<string> = new Set(['stop', 'stop auto', 'stopauto']);

export const isStopVerb = ({ verb }: Params): boolean => {
  const lower = verb.toLowerCase();
  return STOP_VERBS.has(lower) || lower.endsWith('.stop');
};
