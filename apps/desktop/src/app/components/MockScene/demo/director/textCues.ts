import type { AgentId, ProviderRunId } from '@goodboy/types';
import type { DemoCue } from './directorTypes';
import { eventCue } from './eventCue';

import { TEXT_SENTENCE_MS } from './textCuesEndMs';

type Params = {
  readonly atMs: number;
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
  readonly text: string;
  readonly isParagraph?: boolean;
};

export const textCues = ({
  atMs,
  agentId,
  runId,
  text,
  isParagraph = false,
}: Params): ReadonlyArray<DemoCue> => {
  const parts = text.split('. ');
  return parts.map((part, index) =>
    eventCue({
      atMs: atMs + index * TEXT_SENTENCE_MS,
      agentId,
      events: ({ at }) => [
        {
          kind: 'assistant_text',
          runId,
          delta: `${index === 0 ? (isParagraph ? '\n\n' : '') : ' '}${part}${index < parts.length - 1 ? '.' : ''}`,
          at,
        },
      ],
    }),
  );
};
