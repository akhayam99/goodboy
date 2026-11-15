type ValueParams<Value> = {
  readonly value: Value;
};

export const SWITCH_SETTING = {
  encode: ({ value }: ValueParams<boolean>): string => (value ? 'true' : 'false'),
  display: ({ value }: ValueParams<boolean>): string => (value ? 'On' : 'Off'),
};
