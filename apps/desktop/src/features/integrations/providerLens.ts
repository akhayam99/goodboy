import type { SessionExternalTaskProvider } from '@goodboy/types';
import type { LensKind } from '../../store/slices/session-view/types';

export const PROVIDER_LENS: Record<SessionExternalTaskProvider, LensKind> = {
  linear: 'linear',
  sentry: 'sentry',
  gitlab: 'gitlab_issues',
  github: 'pr',
};
