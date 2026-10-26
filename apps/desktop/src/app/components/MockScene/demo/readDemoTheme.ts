import { DEMO_THEME_KEY } from './demoThemeKey';
import type { DemoTheme } from './director/demoProtocol';
import { readDemoThemeValue } from './readDemoThemeValue';

type Params = {
  readonly search: string;
};

const readStored = (): DemoTheme | null => {
  try {
    return readDemoThemeValue({ value: window.localStorage.getItem(DEMO_THEME_KEY) });
  } catch {
    return null;
  }
};

export const readDemoTheme = ({ search }: Params): DemoTheme => {
  const requested = readDemoThemeValue({ value: new URLSearchParams(search).get('theme') });
  return requested ?? readStored() ?? 'dark';
};
