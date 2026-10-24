import type { DemoShortcutCode, DemoShortcutCommand } from './demoProtocol';
import { isDemoEnvelope } from './isDemoEnvelope';

const SHORTCUT_CODES: ReadonlySet<unknown> = new Set<DemoShortcutCode>(['KeyK', 'KeyF', 'KeyB']);

export const isDemoShortcutCommand = (data: unknown): data is DemoShortcutCommand =>
  isDemoEnvelope(data) && data.type === 'shortcut' && SHORTCUT_CODES.has(Reflect.get(data, 'code'));
