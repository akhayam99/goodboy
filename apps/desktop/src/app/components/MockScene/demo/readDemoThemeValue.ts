import type { DemoTheme } from './director/demoProtocol';

type Params = {
  readonly value: unknown;
};

export const readDemoThemeValue = ({ value }: Params): DemoTheme | null =>
  value === 'dark' || value === 'light' ? value : null;
