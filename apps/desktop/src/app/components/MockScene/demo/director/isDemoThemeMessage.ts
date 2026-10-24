import type { DemoThemeMessage } from './demoProtocol';
import { isDemoEnvelope } from './isDemoEnvelope';
import { isDemoTheme } from '../isDemoTheme';

export const isDemoThemeMessage = (data: unknown): data is DemoThemeMessage =>
  isDemoEnvelope(data) && data.type === 'theme' && isDemoTheme(Reflect.get(data, 'theme'));
