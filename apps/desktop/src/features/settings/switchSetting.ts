type ValueParams<Value> = {
  readonly value: Value;
};

export const SWITCH_SETTING = {
  encode: ({ value: isOn }: ValueParams<boolean>): string => (isOn ? 'true' : 'false'),
  display: ({ value: isOn }: ValueParams<boolean>): string => (isOn ? 'On' : 'Off'),
};
