import type { DemoCommand, DemoCommandType } from './demoProtocol';
import { readDemoEnvelope } from './readDemoEnvelope';

type Params = {
  readonly data: unknown;
};

const COMMAND_TYPES: ReadonlyArray<DemoCommandType> = ['play', 'pause', 'restart'];

export const readDemoCommand = ({ data }: Params): DemoCommand | null => {
  const envelope = readDemoEnvelope({ data });
  const type = COMMAND_TYPES.find((candidate) => candidate === envelope?.type);
  if (envelope === null || type === undefined) {
    return null;
  }
  return {
    channel: envelope.channel,
    version: envelope.version,
    generation: envelope.generation,
    type,
  };
};
