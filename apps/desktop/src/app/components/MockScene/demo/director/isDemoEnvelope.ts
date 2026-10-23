import { DEMO_PROTOCOL } from './demoProtocol';

type Envelope = {
  readonly channel: typeof DEMO_PROTOCOL.channel;
  readonly version: typeof DEMO_PROTOCOL.version;
  readonly generation: number;
  readonly type: unknown;
};

export const isDemoEnvelope = (data: unknown): data is Envelope => {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const generation: unknown = Reflect.get(data, 'generation');
  return (
    Reflect.get(data, 'channel') === DEMO_PROTOCOL.channel &&
    Reflect.get(data, 'version') === DEMO_PROTOCOL.version &&
    typeof generation === 'number' &&
    Number.isInteger(generation) &&
    generation >= 0
  );
};
