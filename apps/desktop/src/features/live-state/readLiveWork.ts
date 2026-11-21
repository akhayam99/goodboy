import { invokeCommand } from '../../shared/lib/invokeCommand';
import type { LastTool } from './workingPhraseOf';

export type LiveWorkRow = Readonly<{
  runId: string;
  sessionId: string | null;
  agentId: string | null;
  mountId: string | null;
  workflowRunId: string | null;
  branch: string | null;
  startedAt: number | null;
  quietMs: number | null;
  tool: LastTool | null;
  hasToolCall: boolean;
  canSeeTools: boolean;
}>;

type Params = {
  readonly sessionId: string | null;
};

type FieldParams = {
  readonly value: object;
  readonly key: string;
};

type ValueParams = {
  readonly value: unknown;
};

const textAt = ({ value, key }: FieldParams): string | null => {
  const field: unknown = Reflect.get(value, key);
  return typeof field === 'string' ? field : null;
};

const numberFieldOf = ({ value, key }: FieldParams): number | null => {
  const field: unknown = Reflect.get(value, key);
  return typeof field === 'number' ? field : null;
};

const toolOf = ({ value }: ValueParams): LastTool | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const name = textAt({ value, key: 'name' });
  if (name === null) {
    return null;
  }
  return {
    name,
    command: textAt({ value, key: 'command' }),
    path: textAt({ value, key: 'path' }),
  };
};

const liveWorkRowOf = ({ value }: ValueParams): LiveWorkRow | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const runId = textAt({ value, key: 'runId' });
  const hasToolCall: unknown = Reflect.get(value, 'hasToolCall');
  const canSeeTools: unknown = Reflect.get(value, 'canSeeTools');
  if (runId === null || typeof hasToolCall !== 'boolean' || typeof canSeeTools !== 'boolean') {
    return null;
  }
  return {
    runId,
    sessionId: textAt({ value, key: 'sessionId' }),
    agentId: textAt({ value, key: 'agentId' }),
    mountId: textAt({ value, key: 'mountId' }),
    workflowRunId: textAt({ value, key: 'workflowRunId' }),
    branch: textAt({ value, key: 'branch' }),
    startedAt: numberFieldOf({ value, key: 'startedAt' }),
    quietMs: numberFieldOf({ value, key: 'quietMs' }),
    tool: toolOf({ value: Reflect.get(value, 'tool') }),
    hasToolCall,
    canSeeTools,
  };
};

export const readLiveWork = async ({ sessionId }: Params): Promise<ReadonlyArray<LiveWorkRow>> => {
  const rows = await invokeCommand<unknown>('live_work', { sessionId });
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.flatMap((value: unknown) => {
    const row = liveWorkRowOf({ value });
    return row === null ? [] : [row];
  });
};
