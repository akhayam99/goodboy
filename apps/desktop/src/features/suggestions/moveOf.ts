import type { AgentId, MountId } from '@goodboy/types';
import type { SignalCheckLog } from './nextStepSignals';
import type { NextStepSignals } from './nextStepSignals';
import { isFresh } from './nextStepGates';
import { actionsJobOf } from './signals/actionsJobOf';
import { hostOf } from './signals/hostOf';
import { moveGroupOf } from './moveGroupOf';
import type {
  CompletesWhen,
  MoveEvidence,
  MoveFacts,
  MovePlace,
  MoveRead,
  NextMove,
  SessionSuggestion,
} from './types';

type SuggestionParams = {
  readonly suggestion: SessionSuggestion;
};

type MovePlaceParams = {
  readonly tool: MovePlace['tool'];
  readonly mountId?: MountId | null;
  readonly agentId?: AgentId | null;
};

const placeAt = ({ tool, mountId = null, agentId = null }: MovePlaceParams): MovePlace => ({
  tool,
  mountId,
  agentId,
});

const movePlaceOf = ({ suggestion }: SuggestionParams): MovePlace => {
  switch (suggestion.kind) {
    case 'workflow-next-step':
    case 'continue-with-workflow':
      return placeAt({ tool: 'workflow' });
    case 'plan-ready':
      return placeAt({ tool: 'plans' });
    case 'resolve-threads':
      return placeAt({ tool: 'review' });
    case 'rebase-project':
      return placeAt({
        tool: 'branch',
        mountId: suggestion.payload.targets[0]?.mountId ?? null,
      });
    case 'answer-questions':
      return placeAt({ tool: 'questions' });
    case 'mount-project':
    case 'unmount-folder':
      return placeAt({
        tool: 'mounts',
        mountId: suggestion.kind === 'unmount-folder' ? suggestion.payload.mountId : null,
      });
    case 'approve-tool':
    case 'sign-in':
    case 'retry-agent':
    case 'check-changes':
    case 'ask-agent':
      return placeAt({ tool: 'agent', agentId: suggestion.payload.agentId });
    case 'resume-agents':
      return placeAt({ tool: 'agent', agentId: suggestion.payload.agentIds[0] ?? null });
    case 'fix-checks':
    case 'rerun-check':
      return placeAt({ tool: 'checks', mountId: suggestion.payload.mountId });
    case 'push-branch':
    case 'open-pr':
    case 'mark-ready':
    case 'merge-pr':
      return placeAt({ tool: 'branch', mountId: suggestion.payload.mountId });
    case 'merge-series':
      return placeAt({ tool: 'branch' });
    case 'move-tracker-item':
      return placeAt({ tool: 'tracker' });
    case 'close-worktree':
      return placeAt({ tool: 'mounts', mountId: suggestion.payload.worktrees[0]?.mountId ?? null });
    case 'archive-session':
      return placeAt({ tool: 'session' });
    case 'run-failing-test':
      return placeAt({ tool: 'terminal', mountId: suggestion.payload.mountId });
    case 'next-script':
      return placeAt({
        tool: suggestion.payload.command.mode === 'run' ? 'scripts' : 'terminal',
        mountId: suggestion.payload.mountId,
      });
    default: {
      const exhaustive: never = suggestion;
      return exhaustive;
    }
  }
};

const completesWhenOf = ({ suggestion }: SuggestionParams): CompletesWhen => {
  switch (suggestion.kind) {
    case 'fix-checks':
      return {
        kind: 'check-passes',
        mountId: suggestion.payload.mountId,
        checkName: suggestion.payload.progress?.checkName ?? null,
      };
    case 'rerun-check':
    case 'run-failing-test':
      return {
        kind: 'check-passes',
        mountId: suggestion.payload.mountId,
        checkName: suggestion.payload.checkName,
      };
    case 'next-script':
      return {
        kind: 'script-succeeds',
        scriptId: suggestion.payload.scriptId,
        scriptName: suggestion.payload.scriptName,
        sinceMs: suggestion.payload.turnAtMs,
      };
    case 'mount-project':
      return { kind: 'folder-mounted', projectId: suggestion.payload.projectId };
    case 'unmount-folder':
      return { kind: 'folder-unmounted', mountId: suggestion.payload.mountId };
    case 'close-worktree': {
      const first = suggestion.payload.worktrees[0];
      return first === undefined
        ? { kind: 'move-gone' }
        : { kind: 'worktree-removed', mountId: first.mountId };
    }
    case 'ask-agent':
      return { kind: 'agent-answers', agentId: suggestion.payload.agentId };
    case 'merge-pr':
      return { kind: 'pr-merged', mountId: suggestion.payload.mountId };
    case 'rebase-project': {
      const first = suggestion.payload.targets[0];
      return first === undefined
        ? { kind: 'move-gone' }
        : { kind: 'rebase-finished', mountId: first.mountId };
    }
    case 'workflow-next-step':
    case 'plan-ready':
    case 'resolve-threads':
    case 'answer-questions':
    case 'approve-tool':
    case 'sign-in':
    case 'retry-agent':
    case 'resume-agents':
    case 'push-branch':
    case 'open-pr':
    case 'mark-ready':
    case 'merge-series':
    case 'check-changes':
    case 'move-tracker-item':
    case 'archive-session':
    case 'continue-with-workflow':
      return { kind: 'move-gone' };
    default: {
      const exhaustive: never = suggestion;
      return exhaustive;
    }
  }
};

type MountParams = {
  readonly suggestion: SessionSuggestion;
  readonly signals: NextStepSignals;
};

const MOUNT_READ_KINDS: ReadonlyArray<SessionSuggestion['kind']> = [
  'fix-checks',
  'push-branch',
  'open-pr',
  'mark-ready',
  'merge-pr',
  'rerun-check',
  'run-failing-test',
];

const mountIdOf = ({ suggestion }: SuggestionParams): MountId | null => {
  if (!MOUNT_READ_KINDS.includes(suggestion.kind) || !('mountId' in suggestion.payload)) {
    return null;
  }
  return suggestion.payload.mountId;
};

const readOf = ({ suggestion, signals }: MountParams): MoveRead | null => {
  const mountId = mountIdOf({ suggestion });
  if (mountId === null) {
    return null;
  }
  const fetchedAt = signals.mounts?.find((mount) => mount.mountId === mountId)?.fetchedAt ?? null;
  if (fetchedAt === null) {
    return { state: 'unread', fetchedAt: null };
  }
  const now = signals.now ?? (() => Date.now());
  return { state: isFresh({ fetchedAt, now }) ? 'fresh' : 'stale', fetchedAt };
};

type CheckEvidenceParams = {
  readonly signals: NextStepSignals;
  readonly mountId: MountId;
  readonly detailsUrl: string | null;
};

const failedCheckEvidenceOf = ({
  signals,
  mountId,
  detailsUrl,
}: CheckEvidenceParams): ReadonlyArray<MoveEvidence> => {
  const failed = signals.mounts?.find((mount) => mount.mountId === mountId)?.failedChecks ?? [];
  const first =
    detailsUrl === null ? failed[0] : failed.find((check) => check.detailsUrl === detailsUrl);
  if (first === undefined || first.detailsUrl === null) {
    return [];
  }
  if (actionsJobOf({ detailsUrl: first.detailsUrl }) !== null) {
    const reading: SignalCheckLog | undefined = signals.checkLogs?.find(
      (candidate) => candidate.detailsUrl === first.detailsUrl,
    );
    return reading !== undefined && reading.status === 'ready' && reading.lines.length > 0
      ? [{ kind: 'log', label: 'Log', lines: reading.lines }]
      : [];
  }
  const host = hostOf({ url: first.detailsUrl });
  return host === null ? [] : [{ kind: 'link', label: `Open on ${host}`, url: first.detailsUrl }];
};

const evidenceOf = ({ suggestion, signals }: MountParams): ReadonlyArray<MoveEvidence> => {
  if (suggestion.kind === 'fix-checks') {
    return failedCheckEvidenceOf({
      signals,
      mountId: suggestion.payload.mountId,
      detailsUrl: null,
    });
  }
  if (suggestion.kind === 'rerun-check') {
    return failedCheckEvidenceOf({
      signals,
      mountId: suggestion.payload.mountId,
      detailsUrl: suggestion.payload.detailsUrl,
    });
  }
  if (suggestion.kind === 'run-failing-test') {
    return [
      ...failedCheckEvidenceOf({
        signals,
        mountId: suggestion.payload.mountId,
        detailsUrl: suggestion.payload.detailsUrl,
      }),
      { kind: 'command', label: 'Command', command: suggestion.payload.command.text },
    ];
  }
  if (suggestion.kind === 'next-script') {
    const turn = signals.turnFiles
      ?.filter((entry) => entry.mountId === suggestion.payload.mountId)
      .sort((first, second) => second.recordedAtMs - first.recordedAtMs)[0];
    return [
      ...(turn === undefined
        ? []
        : [{ kind: 'files' as const, label: 'Files', paths: turn.paths }]),
      { kind: 'command', label: 'Command', command: suggestion.payload.command.text },
    ];
  }
  if (suggestion.kind === 'ask-agent') {
    return [{ kind: 'quiet', label: 'Quiet', quietMs: suggestion.payload.quietMs }];
  }
  return [];
};

type Params = {
  readonly suggestion: SessionSuggestion;
  readonly signals: NextStepSignals;
};

export const moveOf = ({ suggestion, signals }: Params): NextMove | null => {
  const reason = suggestion.detail?.trim() ?? '';
  if (reason === '') {
    return null;
  }
  const facts: MoveFacts = {
    reason,
    evidence: evidenceOf({ suggestion, signals }),
    place: movePlaceOf({ suggestion }),
    completesWhen: completesWhenOf({ suggestion }),
    group: moveGroupOf({ suggestion }),
    read: readOf({ suggestion, signals }),
  };
  return { ...suggestion, ...facts };
};
