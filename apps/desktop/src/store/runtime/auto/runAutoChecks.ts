import {
  AUTO_CHECK_TIMEOUT_MS,
  checksVerdictOf,
  missingChecksOf,
  notCheckedOf,
  type CheckReport,
  type ChecksVerdict,
  type MountSnapshot,
} from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { createKeyedQueue } from '../../../shared/utils/keyedQueue';
import type { AutoCheckList, AutoCheckScript, AutoPorts } from './ports';
import { readSnapshot } from './readSnapshot';

const queue = createKeyedQueue();

export type RunAutoChecksParams = Readonly<{
  ports: AutoPorts;
  sessionId: SessionId;
  mountId: string;
  worktreePath: string;
  expectedHead?: string;
}>;

type CleanParams = {
  readonly snapshot: MountSnapshot;
};

const isClean = ({ snapshot }: CleanParams): boolean =>
  snapshot.entries.length === 0 && !snapshot.isPartial;

type ListParams = {
  readonly ports: AutoPorts;
  readonly sessionId: SessionId;
  readonly mountId: string;
};

const listed = async ({ ports, sessionId, mountId }: ListParams): Promise<AutoCheckList | null> => {
  try {
    return await ports.listChecks({ sessionId, mountId });
  } catch {
    return null;
  }
};

type ScriptParams = RunAutoChecksParams & {
  readonly check: AutoCheckScript;
};

const reportOf = async ({
  ports,
  sessionId,
  mountId,
  worktreePath,
  check,
}: ScriptParams): Promise<CheckReport> => {
  try {
    const status = await ports.runCheck({
      sessionId,
      mountId,
      worktreePath,
      check,
      timeoutMs: AUTO_CHECK_TIMEOUT_MS,
    });
    return { name: check.name, status };
  } catch {
    return { name: check.name, status: 'unknown' };
  }
};

const verdictOf = async (params: RunAutoChecksParams): Promise<ChecksVerdict> => {
  const { ports, sessionId, mountId, worktreePath, expectedHead } = params;
  const checks = await listed({ ports, sessionId, mountId });
  const before = await readSnapshot({ ports, worktreePath });
  if (checks === null || before === null) {
    return notCheckedOf({ reason: 'not_available', commit: expectedHead ?? null });
  }
  const commit = expectedHead ?? before.head;
  if (expectedHead !== undefined && expectedHead !== before.head) {
    return notCheckedOf({ reason: 'tree_moved', commit });
  }
  if (checks.missing.length > 0) {
    return missingChecksOf({ missing: checks.missing, commit });
  }
  if (checks.scripts.length === 0) {
    return notCheckedOf({ reason: 'none_ticked', commit });
  }
  if (!isClean({ snapshot: before })) {
    return notCheckedOf({ reason: 'tree_dirty', commit });
  }
  const reports: CheckReport[] = [];
  for (const check of checks.scripts) {
    reports.push(await reportOf({ ...params, check }));
  }
  const after = await readSnapshot({ ports, worktreePath });
  if (after === null || after.head !== commit || !isClean({ snapshot: after })) {
    return notCheckedOf({ reason: 'tree_moved', commit });
  }
  return checksVerdictOf({ reports, commit });
};

export const runAutoChecks = (params: RunAutoChecksParams): Promise<ChecksVerdict> =>
  queue.run({ key: params.worktreePath, task: () => verdictOf(params) });
