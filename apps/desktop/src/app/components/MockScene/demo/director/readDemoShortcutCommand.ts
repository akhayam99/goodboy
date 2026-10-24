import type { DemoShortcutCode, DemoShortcutCommand } from './demoProtocol';
import { isDemoEnvelope } from './isDemoEnvelope';

const SHORTCUT_CODES: ReadonlyMap<unknown, DemoShortcutCode> = new Map<unknown, DemoShortcutCode>([
  ['KeyK', 'KeyK'],
  ['KeyF', 'KeyF'],
  ['KeyB', 'KeyB'],
]);

type Params = {
  readonly data: unknown;
};

export const readDemoShortcutCommand = ({ data }: Params): DemoShortcutCommand | null => {
  if (!isDemoEnvelope(data) || data.type !== 'shortcut') {
    return null;
  }
  const code = SHORTCUT_CODES.get(Reflect.get(data, 'code'));
  return code === undefined ? null : { ...data, type: 'shortcut', code };
};
