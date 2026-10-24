import type { DemoThemeMessage } from './demoProtocol';
import { isDemoEnvelope } from './isDemoEnvelope';
import { isDemoTheme } from '../isDemoTheme';

type Params = {
  readonly data: unknown;
};

export const readDemoThemeMessage = ({ data }: Params): DemoThemeMessage | null => {
  if (!isDemoEnvelope(data) || data.type !== 'theme') {
    return null;
  }
  const theme: unknown = Reflect.get(data, 'theme');
  return isDemoTheme(theme) ? { ...data, type: 'theme', theme } : null;
};
