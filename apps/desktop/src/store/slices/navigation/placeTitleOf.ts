import { agentDisplayName } from '../../../shared/utils/agentDisplayName';
import { LENS_LABEL } from '../../../features/session/lens-labels';
import { agentTaskLabelOf } from '../../../features/auto/agentTaskLabelOf';
import { autoRunTitleOf } from '../../../features/session/autoRunTitleOf';
import { isDefaultAgentName } from '../../../features/session/isDefaultAgentName';
import { NAMES } from '../../../shared/utils/names';
import type { AppState } from '../../types';
import type { LensKind } from '../session-view/types';
import { runTitleOf } from './runTitleOf';
import type { Place } from './types';

export type PlaceTitle = {
  readonly title: string;
  readonly isName: boolean;
};

type Params = {
  readonly state: AppState;
  readonly place: Place;
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
    if (agent === undefined) {
      return word({ title: 'Agent' });
    }
    const runTitle = autoRunTitleOf({ state, sessionId, agentId: agent.id });
    if (runTitle !== null) {
      return name({ title: runTitle });
    }
    const task = agentTaskLabelOf({ views: state.autoTreeViews[sessionId], agentId: agent.id });
    if (task !== null && isDefaultAgentName({ name: agent.name, kind: task.kind })) {
      return name({ title: `${task.role} · ${task.title}` });
    }
    return name({ title: agentDisplayName({ name: agent.name, kind: agent.kind ?? '' }) });
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
