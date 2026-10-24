import { DEMO_THEME_KEY } from './demoThemeKey';
import type { DemoTheme } from './director/demoProtocol';
import { isDemoTheme } from './isDemoTheme';

type Params = {
  readonly search: string;
};

const readStored = (): DemoTheme | null => {
  try {
    const stored = window.localStorage.getItem(DEMO_THEME_KEY);
    return isDemoTheme(stored) ? stored : null;
  } catch {
    return null;
  }
};

export const readDemoTheme = ({ search }: Params): DemoTheme => {
  const requested = new URLSearchParams(search).get('theme');
  if (isDemoTheme(requested)) {
    return requested;
  }
  return readStored() ?? 'dark';
};
