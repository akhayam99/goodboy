import { agentDisplayName } from '../../../shared/utils/agentDisplayName';
import { LENS_LABEL } from '../../../features/session/lens-labels';
import { NAMES } from '../../../shared/utils/names';
import type { AppState } from '../../types';
import type { LensKind } from '../session-view/types';
import { parentPlace } from './parentPlace';
import type { Place } from './types';

type SessionPlace = Extract<Place, { readonly at: 'session' }>;

type Params = {
  readonly state: AppState;
  readonly place: Place;
};

type LabelParams = {
  readonly state: AppState;
  readonly parent: SessionPlace;
};

type LoweredParams = {
  readonly label: string;
};

export type Back = {
  readonly label: string;
  readonly to: Place;
};

const PROVIDER_LENSES: ReadonlySet<LensKind> = new Set<LensKind>([
  'linear',
  'gitlab_issues',
  'jira_issues',
  'github_issue',
  'slack_threads',
]);

const lowered = ({ label }: LoweredParams): string => label.toLowerCase();

const parentLabel = ({ state, parent }: LabelParams): string => {
  const { view } = parent;
  if (view.agentId !== null) {
    const agent = state.sessionPhaseRuns[parent.sessionId]?.find(
      (candidate) => candidate.id === view.agentId,
    );
    return agent === undefined
      ? 'agent'
      : agentDisplayName({ name: agent.name, kind: agent.kind ?? '' });
  }
  if (view.target?.kind === 'branch') {
    return lowered({ label: NAMES.branch });
  }
  if (view.target?.kind === 'run') {
    return 'run';
  }
  if (view.lens !== null) {
    const label = LENS_LABEL[view.lens];
    return PROVIDER_LENSES.has(view.lens) ? label : lowered({ label });
  }
  return lowered({ label: NAMES.overview });
};

export const backOf = ({ state, place }: Params): Back | null => {
  const parent = parentPlace({ state, place });
  if (parent === null || parent.at !== 'session') {
    return null;
  }
  return { label: `Back to ${parentLabel({ state, parent })}`, to: parent };
};
