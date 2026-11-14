import { resolveRootAgent } from '../../../features/session/agent-kind';
import type { AppState } from '../../types';
import { agentHomeFor } from './agentHomeFor';
import { branchPlace, sessionPlace } from './place';
import { placeBeforeDraft } from './placeBeforeDraft';
import { runGroupFocusOf } from './runGroupFocusOf';
import type { LensKind } from '../session-view/types';
import type { Place, SessionView } from './types';

type Params = {
  readonly state: AppState;
  readonly place: Place;
};

const BRANCH_WORK_LENSES: ReadonlySet<LensKind | null> = new Set<LensKind | null>([
  'workflows',
  'questions',
  'plans',
]);

const SESSION_TABS: ReadonlySet<LensKind> = new Set<LensKind>([
  'workflows',
  'orchestrated',
  'plans',
  'questions',
  'context',
  'files',
]);

type ItemParams = {
  readonly view: SessionView;
};

const isBranchWorkItem = ({ view }: ItemParams): boolean =>
  view.agentId !== null || view.target?.kind === 'run' || view.target?.kind === 'artifact';

export const parentPlace = ({ state, place }: Params): Place | null => {
  if (place.at === 'board') {
    return null;
  }
  if (place.at === 'session-draft') {
    return placeBeforeDraft({ state });
  }
  const { sessionId, view } = place;
  if (view.target?.kind === 'branch') {
    const { target } = view;
    const isItemOpen =
      state.drawer?.kind === 'conversation' && state.drawer.sessionId === sessionId;
    if (target.threadId !== null && !isItemOpen) {
      return { ...place, view: { ...view, target: { ...target, threadId: null } } };
    }
    if (target.tab === 'files' && target.focus?.path != null) {
      const isPlainFile = target.focus.kind === 'branch' && target.focus.threadId == null;
      return {
        ...place,
        view: {
          ...view,
          target: {
            ...target,
            focus: isPlainFile ? null : { ...target.focus, path: null },
          },
        },
      };
    }
    return sessionPlace({ sessionId });
  }
  const fromBranch = runGroupFocusOf({ state });
  if (fromBranch !== null && isBranchWorkItem({ view })) {
    return branchPlace({ sessionId, mountPath: fromBranch.mountPath, tab: 'work' });
  }
  if (view.agentId !== null && view.target?.kind === 'thread' && view.lens === 'review') {
    return sessionPlace({ sessionId, lens: 'review' });
  }
  if (view.agentId !== null) {
    const agents = state.sessionPhaseRuns[sessionId] ?? [];
    const agent = agents.find((candidate) => candidate.id === view.agentId);
    const parentAgentId = agent?.parentAgentId ?? null;
    const isStep = agent?.workflowRunId != null && agent.stepId != null;
    const parent = agents.find((candidate) => candidate.id === parentAgentId);
    const isParentStepOfRun =
      parent?.workflowRunId != null &&
      parent.stepId != null &&
      parent.workflowRunId === agent?.workflowRunId;
    const home = agentHomeFor({ state, sessionId, agentId: view.agentId }) ?? view.lens;
    if (
      (!isStep || isParentStepOfRun) &&
      parentAgentId !== null &&
      parentAgentId !== view.agentId &&
      parent !== undefined
    ) {
      return sessionPlace({ sessionId, lens: home, agentId: parentAgentId });
    }
    const root = resolveRootAgent({ agents, agentId: view.agentId });
    const isRunHome = root?.workflowRunId != null && root.stepId != null;
    const runId = isRunHome ? (agent?.workflowRunId ?? null) : null;
    if (runId === null && home === 'workflows' && root?.id === view.agentId) {
      return sessionPlace({ sessionId });
    }
    return sessionPlace({
      sessionId,
      lens: home,
      target: runId === null ? null : { kind: 'run', runId },
    });
  }
  if (
    view.target?.kind === 'github-issue' ||
    view.target?.kind === 'external-task' ||
    view.target?.kind === 'question'
  ) {
    return sessionPlace({ sessionId });
  }
  if (view.target !== null && view.target.kind !== 'diff' && view.target.kind !== 'thread') {
    return { ...place, view: { ...view, target: null } };
  }
  if (view.target?.kind === 'diff' && view.target.focus !== null) {
    return { ...place, view: { ...view, target: { ...view.target, focus: null } } };
  }
  if (BRANCH_WORK_LENSES.has(view.lens) && view.target === null && fromBranch !== null) {
    return branchPlace({ sessionId, mountPath: fromBranch.mountPath, tab: 'work' });
  }
  if (view.lens !== null && !SESSION_TABS.has(view.lens)) {
    return sessionPlace({ sessionId });
  }
  return null;
};
