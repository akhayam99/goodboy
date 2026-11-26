import type { AgentId, ProviderRunId } from '@goodboy/types';
import type { DemoCue } from './directorTypes';
import { eventCue } from './eventCue';

type Params = {
  readonly startMs: number;
  readonly endMs: number;
  readonly agentId: AgentId;
  readonly runId: ProviderRunId;
  readonly command: string;
  readonly output: string;
};

export const storyToolCues = ({
  startMs,
  endMs,
  agentId,
  runId,
  command,
  output,
}: Params): ReadonlyArray<DemoCue> => {
  const toolUseId = `demo-story-tool-${runId}-${startMs}`;
  return [
    eventCue({
      atMs: startMs,
      agentId,
      events: ({ at }) => [
        { kind: 'tool_call_start', runId, toolUseId, toolName: 'Bash', input: { command }, at },
      ],
    }),
    eventCue({
      atMs: endMs,
      agentId,
      events: ({ at }) => [{ kind: 'tool_call_end', runId, toolUseId, output, isError: false, at }],
    }),
  ];
};
