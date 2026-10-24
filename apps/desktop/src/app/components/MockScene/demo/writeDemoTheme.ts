import { DEMO_THEME_KEY } from './demoThemeKey';
import type { DemoTheme } from './director/demoProtocol';

type Params = {
  readonly theme: DemoTheme;
};

export const writeDemoTheme = ({ theme }: Params): void => {
  try {
    window.localStorage.setItem(DEMO_THEME_KEY, theme);
  } catch {
    return;
  }
};
