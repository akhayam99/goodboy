import { isWorkflowRoutingLock } from '@goodboy/db';
import type { WorkflowRoutingLock } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';

export type RunStepLock = Readonly<{
  role: string;
  routingLock: WorkflowRoutingLock;
}>;

export type RunLocksSetting = Readonly<{
  agents: Readonly<Record<string, ReadonlyArray<RunStepLock>>>;
}>;

type Params = { readonly raw: string | null };

type StepParams = { readonly value: unknown };

const stepLockOf = ({ value }: StepParams): RunStepLock | null => {
  if (!isRecord(value) || typeof value['role'] !== 'string') {
    return null;
  }
  const routingLock = value['routingLock'];
  return isWorkflowRoutingLock(routingLock) ? { role: value['role'], routingLock } : null;
};

export const parseRunLocks = ({ raw }: Params): RunLocksSetting => {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw ?? 'null');
  } catch {
    parsed = null;
  }
  if (!isRecord(parsed) || !isRecord(parsed['agents'])) {
    return { agents: {} };
  }
  const entries: Array<readonly [string, ReadonlyArray<RunStepLock>]> = [];
  for (const [agentId, value] of Object.entries(parsed['agents'])) {
    if (Array.isArray(value)) {
      const steps: ReadonlyArray<unknown> = value;
      entries.push([
        agentId,
        steps
          .map((step) => stepLockOf({ value: step }))
          .filter((step): step is RunStepLock => step !== null),
      ]);
    }
  }
  return { agents: Object.fromEntries(entries) };
};
