import type { DemoHintsCommand } from './demoProtocol';
import { readDemoEnvelope } from './readDemoEnvelope';
import { readHintId } from './readHintId';

const MAX_SETTLED = 64;

type Params = {
  readonly data: unknown;
};

type ValueParams = {
  readonly value: unknown;
};

const settledIdsOf = ({ value }: ValueParams): ReadonlyArray<string> | null => {
  if (!Array.isArray(value) || value.length > MAX_SETTLED) {
    return null;
  }
  const ids = value.flatMap((entry) => {
    const id = readHintId({ value: entry });
    return id === null ? [] : [id];
  });
  return ids.length === value.length ? ids : null;
};

export const readDemoHintsCommand = ({ data }: Params): DemoHintsCommand | null => {
  const envelope = readDemoEnvelope({ data });
  if (envelope === null || envelope.type !== 'hints') {
    return null;
  }
  const chapterId = readHintId({ value: Reflect.get(envelope.data, 'chapterId') });
  const settledIds = settledIdsOf({ value: Reflect.get(envelope.data, 'settledIds') });
  const isGuarding: unknown = Reflect.get(envelope.data, 'isGuarding');
  if (chapterId === null || settledIds === null || typeof isGuarding !== 'boolean') {
    return null;
  }
  return {
    channel: envelope.channel,
    version: envelope.version,
    generation: envelope.generation,
    type: 'hints',
    chapterId,
    settledIds,
    isGuarding,
  };
};
