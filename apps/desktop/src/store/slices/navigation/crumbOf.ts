import type { LucideIcon } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { LENS_ICON, LENS_LABEL } from '../../../features/session/lens-labels';
import { sessionTitle } from '../../../shared/utils/sessionTitle';
import { selectSessionById } from '../sessions/selectSessionById';
import type { AppState } from '../../types';
import type { Place } from './types';

type Params = {
  readonly state: AppState;
  readonly place: Place;
};

type Crumb = {
  readonly label: string;
  readonly icon: LucideIcon;
};

export const crumbOf = ({ state, place }: Params): Crumb => {
  if (place.at !== 'session') {
    return { label: 'Sessions', icon: CONCEPT_ICONS.timeline };
  }
  const { view } = place;
  if (view.target?.kind === 'branch') {
    if (view.target.threadId !== null) {
      return { label: 'Thread', icon: LENS_ICON.review };
    }
    if ((view.target.focus?.path ?? null) !== null) {
      return { label: 'File', icon: LENS_ICON.files };
    }
    return { label: 'Branch', icon: LENS_ICON.branch };
  }
  if (view.agentId !== null) {
    return { label: 'Agent', icon: CONCEPT_ICONS.agents };
  }
  if (view.target?.kind === 'run') {
    return { label: 'Run', icon: LENS_ICON.workflows };
  }
  if (view.target?.kind === 'artifact') {
    return { label: 'Artifact', icon: LENS_ICON.plans };
  }
  if (view.target?.kind === 'github-issue' || view.target?.kind === 'external-task') {
    return { label: 'Issue', icon: LENS_ICON.github_issue };
  }
  if (view.lens !== null) {
    return { label: LENS_LABEL[view.lens], icon: LENS_ICON[view.lens] };
  }
  return {
    label: sessionTitle({ session: selectSessionById(state, place.sessionId) }),
    icon: CONCEPT_ICONS.timeline,
  };
};
