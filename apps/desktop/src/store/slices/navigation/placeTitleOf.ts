import type { SessionId } from '@goodboy/types';
import { agentDisplayName } from '../../../shared/utils/agentDisplayName';
import { LENS_LABEL } from '../../../features/session/lens-labels';
import { NAMES } from '../../../shared/utils/names';
import type { AppState } from '../../types';
import type { LensKind } from '../session-view/types';
import { sessionById } from '../sessions/sessionIndex';
import type { Place } from './types';

export type PlaceTitle = {
  readonly title: string;
  readonly isName: boolean;
};

type Params = {
  readonly state: AppState;
  readonly place: Place;
};

type RunParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly runId: string;
};

const PROVIDER_LENSES: ReadonlySet<LensKind> = new Set<LensKind>([
  'linear',
  'gitlab_issues',
  'jira_issues',
  'github_issue',
  'slack_threads',
]);

type TitleParams = {
  readonly title: string;
};

const word = ({ title }: TitleParams): PlaceTitle => ({ title, isName: false });

const name = ({ title }: TitleParams): PlaceTitle => ({ title, isName: true });

const runTitleOf = ({ state, sessionId, runId }: RunParams): string | null => {
  const session = sessionById(state.sessions, sessionId) ?? null;
  const run = session?.workflowRuns.find((candidate) => candidate.id === runId) ?? null;
  if (run === null) {
    return null;
  }
  if (run.title != null && run.title.trim() !== '') {
    return run.title;
  }
  const workflows = [
    ...(state.sessionWorkflows[sessionId] ?? []),
    ...(session === null ? [] : (state.phaseTemplates[session.workspaceId] ?? [])),
  ];
  return workflows.find((workflow) => workflow.id === run.workflowId)?.name ?? null;
};

export const placeTitleOf = ({ state, place }: Params): PlaceTitle => {
  if (place.at === 'board') {
    return word({ title: 'Board' });
  }
  if (place.at === 'session-draft') {
    return word({ title: 'New session' });
  }
  const { sessionId, view } = place;
  if (view.agentId !== null) {
    const agent = state.sessionPhaseRuns[sessionId]?.find(
      (candidate) => candidate.id === view.agentId,
    );
    return agent === undefined
      ? word({ title: 'Agent' })
      : name({ title: agentDisplayName({ name: agent.name, kind: agent.kind ?? '' }) });
  }
  if (view.target?.kind === 'branch') {
    return word({ title: NAMES.branch });
  }
  if (view.target?.kind === 'run') {
    const title = runTitleOf({ state, sessionId, runId: view.target.runId });
    return title === null ? word({ title: 'Run' }) : name({ title });
  }
  if (view.lens !== null) {
    const title = LENS_LABEL[view.lens];
    return PROVIDER_LENSES.has(view.lens) ? name({ title }) : word({ title });
  }
  return word({ title: NAMES.overview });
};
