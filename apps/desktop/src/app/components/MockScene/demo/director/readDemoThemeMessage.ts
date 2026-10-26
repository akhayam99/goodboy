import type { DemoThemeMessage } from './demoProtocol';
import { readDemoEnvelope } from './readDemoEnvelope';
import { readDemoThemeValue } from '../readDemoThemeValue';

type Params = {
  readonly data: unknown;
};

export const readDemoThemeMessage = ({ data }: Params): DemoThemeMessage | null => {
  const envelope = readDemoEnvelope({ data });
  if (envelope === null || envelope.type !== 'theme') {
    return null;
  }
  const theme = readDemoThemeValue({ value: Reflect.get(envelope.data, 'theme') });
  return theme === null
    ? null
    : {
        channel: envelope.channel,
        version: envelope.version,
        generation: envelope.generation,
        type: 'theme',
        theme,
      };
};
