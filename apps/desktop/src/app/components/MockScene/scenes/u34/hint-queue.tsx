import type { ComponentType } from 'react';
import { HintQueueScene } from './HintQueueScene';

export const U34_HINT_QUEUE_SCENES = {
  'u34-p24-ten-hints': () => <HintQueueScene isReading={false} />,
  'u34-p24-ten-hints-reading': () => <HintQueueScene isReading />,
} satisfies Readonly<Record<string, ComponentType>>;
