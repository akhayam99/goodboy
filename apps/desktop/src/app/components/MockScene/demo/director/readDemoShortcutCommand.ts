import type { DemoShortcutCode, DemoShortcutCommand } from './demoProtocol';
import { readDemoEnvelope } from './readDemoEnvelope';

const SHORTCUT_CODES: ReadonlyMap<unknown, DemoShortcutCode> = new Map<unknown, DemoShortcutCode>([
  ['KeyK', 'KeyK'],
  ['KeyF', 'KeyF'],
  ['KeyB', 'KeyB'],
]);

type Params = {
  readonly data: unknown;
};

export const readDemoShortcutCommand = ({ data }: Params): DemoShortcutCommand | null => {
  const envelope = readDemoEnvelope({ data });
  if (envelope === null || envelope.type !== 'shortcut') {
    return null;
  }
  const code = SHORTCUT_CODES.get(Reflect.get(envelope.data, 'code'));
  return code === undefined
    ? null
    : {
        channel: envelope.channel,
        version: envelope.version,
        generation: envelope.generation,
        type: 'shortcut',
        code,
      };
};
