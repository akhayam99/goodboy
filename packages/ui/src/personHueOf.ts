const HUE_SLOTS = 8;
const HUE_START = 120;
const HUE_STEP = 30;

type Params = {
  readonly login: string;
};

export const personHueOf = ({ login }: Params): number => {
  let hash = 0;
  for (const char of login.toLowerCase()) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return HUE_START + (hash % HUE_SLOTS) * HUE_STEP;
};
