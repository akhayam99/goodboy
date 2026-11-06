export type TrackRule = readonly string[] | { readonly pattern: string };

export type TrackSpec = Readonly<Record<string, Readonly<Record<string, TrackRule>>>>;

export type TrackedEvent = {
  readonly event: string;
  readonly params: Readonly<Record<string, string>>;
};

type Params = {
  readonly attributes: Readonly<Record<string, string>>;
  readonly spec: TrackSpec;
};

type ValueParams = {
  readonly rule: TrackRule;
  readonly value: string | undefined;
};

const PREFIX = 'data-track-';

const isAllowed = ({ rule, value }: ValueParams) => {
  if (value === undefined) {
    return false;
  }
  if ('pattern' in rule) {
    return new RegExp(rule.pattern).test(value);
  }
  return rule.includes(value);
};

export const readTrackEvent = ({ attributes, spec }: Params): TrackedEvent | null => {
  const event = attributes['data-track'];
  if (event === undefined || !Object.hasOwn(spec, event)) {
    return null;
  }
  const rules = spec[event];
  const declared = Object.keys(attributes)
    .filter((name) => name.startsWith(PREFIX))
    .map((name) => name.slice(PREFIX.length).replace(/-/g, '_'));
  if (declared.some((name) => !Object.hasOwn(rules, name))) {
    return null;
  }
  const entries = Object.entries(rules).map(([name, rule]) => {
    const value = attributes[`${PREFIX}${name.replace(/_/g, '-')}`];
    return [name, value, isAllowed({ rule, value })] as const;
  });
  if (entries.some(([, , isValid]) => !isValid)) {
    return null;
  }
  return {
    event,
    params: Object.fromEntries(entries.map(([name, value]) => [name, value ?? ''])),
  };
};
