import type { DemoOfferCommand } from './demoProtocol';
import { readDemoEnvelope } from './readDemoEnvelope';
import { readHintId } from './readHintId';

type Params = {
  readonly data: unknown;
};

export const readDemoOfferCommand = ({ data }: Params): DemoOfferCommand | null => {
  const envelope = readDemoEnvelope({ data });
  if (envelope === null || envelope.type !== 'offer') {
    return null;
  }
  const hintId = readHintId({ value: Reflect.get(envelope.data, 'hintId') });
  if (hintId === null) {
    return null;
  }
  return {
    channel: envelope.channel,
    version: envelope.version,
    generation: envelope.generation,
    type: 'offer',
    hintId,
  };
};
