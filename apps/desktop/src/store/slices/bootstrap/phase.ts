import type {
  BootstrapPhase,
  BootstrapStage,
  IsoDateTime,
  ProjectId,
  SessionId,
} from '@goodboy/types';

const PHASE_KEY_PREFIX = 'bootstrap.phase.';

const STAGE_ORDER: Readonly<Record<BootstrapStage, number>> = {
  'first-lap': 0,
  moving: 1,
  done: 2,
};

export const bootstrapPhaseKey = (projectId: ProjectId): string =>
  `${PHASE_KEY_PREFIX}${projectId}`;

export const bootstrapPhasePrefix = (): string => PHASE_KEY_PREFIX;

export const projectIdOfPhaseKey = (key: string): ProjectId | null =>
  key.startsWith(PHASE_KEY_PREFIX) && key.length > PHASE_KEY_PREFIX.length
    ? (key.slice(PHASE_KEY_PREFIX.length) as ProjectId)
    : null;

const isStage = (value: unknown): value is BootstrapStage =>
  value === 'first-lap' || value === 'moving' || value === 'done';

const nullableString = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

export const parseBootstrapPhase = (raw: string): BootstrapPhase | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const record = new Map(Object.entries(parsed));
  const stage = record.get('stage');
  const updatedAt = nullableString(record.get('updatedAt'));
  if (!isStage(stage) || updatedAt === null) {
    return null;
  }
  const firstLapSessionId = nullableString(record.get('firstLapSessionId'));
  const bootstrapSessionId = nullableString(record.get('bootstrapSessionId'));
  return {
    stage,
    firstLapSessionId: firstLapSessionId === null ? null : (firstLapSessionId as SessionId),
    bootstrapSessionId: bootstrapSessionId === null ? null : (bootstrapSessionId as SessionId),
    snapshotId: nullableString(record.get('snapshotId')),
    worktreePath: nullableString(record.get('worktreePath')),
    branch: nullableString(record.get('branch')),
    updatedAt: updatedAt as IsoDateTime,
  };
};

export const serializeBootstrapPhase = (phase: BootstrapPhase): string => JSON.stringify(phase);

export const freshBootstrapPhase = (at: IsoDateTime): BootstrapPhase => ({
  stage: 'first-lap',
  firstLapSessionId: null,
  bootstrapSessionId: null,
  snapshotId: null,
  worktreePath: null,
  branch: null,
  updatedAt: at,
});

export const canMoveStage = ({
  from,
  to,
}: {
  readonly from: BootstrapStage;
  readonly to: BootstrapStage;
}): boolean => STAGE_ORDER[to] >= STAGE_ORDER[from];
