import type { DemoTheme } from './director/demoProtocol';

export const isDemoTheme = (value: unknown): value is DemoTheme =>
  value === 'dark' || value === 'light';
