import type { AgentId, ProviderRunId } from '@goodboy/types';
import type { DemoCue } from './directorTypes';
import { eventCue } from './eventCue';

import { textCuesEndMs } from './textCuesEndMs';

type Params = {
  readonly atMs: number;
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
  readonly text: string;
  readonly isParagraph?: boolean;
  readonly maxSpanMs?: number;
};

export const textCues = ({
  atMs,
  agentId,
  runId,
  text,
  isParagraph = false,
  maxSpanMs,
}: Params): ReadonlyArray<DemoCue> => {
  const parts = text.split('. ');
  const stepMs = textCuesEndMs({ atMs: 0, text, maxSpanMs }) / parts.length;
  return parts.map((part, index) =>
    eventCue({
      atMs: atMs + index * stepMs,
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
