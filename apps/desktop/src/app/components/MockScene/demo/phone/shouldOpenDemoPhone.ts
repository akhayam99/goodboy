const PHONE_QUERY = '(hover: none) and (pointer: coarse)';
const DEMO_SCENE = 'demo';
const DEMO_MODE = 'demo';

type Params = {
  readonly search: string;
  readonly mode: string;
};

const isPhonePointer = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches;

export const shouldOpenDemoPhone = ({ search, mode }: Params): boolean => {
  const requested = new URLSearchParams(search).get('scene');
  const scene = requested ?? (mode === DEMO_MODE ? DEMO_SCENE : undefined);
  if (scene !== DEMO_SCENE) {
    return false;
  }
  return isPhonePointer();
};
