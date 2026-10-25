import { DEMO_PROTOCOL } from './demoProtocol';

type Params = {
  readonly data: unknown;
};

export type DemoEnvelope = {
  readonly channel: typeof DEMO_PROTOCOL.channel;
  readonly version: typeof DEMO_PROTOCOL.version;
  readonly generation: number;
  readonly type: unknown;
  readonly data: object;
};

export const readDemoEnvelope = ({ data }: Params): DemoEnvelope | null => {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const generation: unknown = Reflect.get(data, 'generation');
  const isEnvelope =
    Reflect.get(data, 'channel') === DEMO_PROTOCOL.channel &&
    Reflect.get(data, 'version') === DEMO_PROTOCOL.version &&
    typeof generation === 'number' &&
    Number.isInteger(generation) &&
    generation >= 0;
  if (!isEnvelope) {
    return null;
  }
  return {
    channel: DEMO_PROTOCOL.channel,
    version: DEMO_PROTOCOL.version,
    generation,
    type: Reflect.get(data, 'type'),
    data,
  };
};
