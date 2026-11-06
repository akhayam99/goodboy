import type { PullRequestHost } from '@goodboy/types';
import { NAMES } from '../../shared/utils/names';
import type { PlaceRequest } from '../../store/slices/navigation/types';
import { requestNounLabel } from '../branch/requestNounLabel';
import type { NotificationPlaceReason } from './notificationPlaceReason';

const SESSION_LABEL = 'Open session';

const LABEL = {
  'agent-error': 'Open agent',
  'push-failed': `Open ${NAMES.comments}`,
  'open-question': 'Open Questions',
  'fix-needs-you': `Open ${NAMES.comments}`,
  'fix-couldnt-fix': `Open ${NAMES.comments}`,
  'unread-reply': 'Open agent',
  'ci-failed': 'Open Checks',
  'changes-requested': 'Open pull request',
  'pr-queued': SESSION_LABEL,
  'pr-approved': 'Open pull request',
  'pr-opened': 'Open pull request',
  'needs-approval': 'Open agent',
  'plan-approval': 'Open run',
  'run-stopped': 'Open run',
  'run-paused-at-limit': 'Open run',
  'run-waits-for-go': 'Open run',
  'auto-needs-you': 'Open Auto',
  'slack-reply-waiting': 'Open agent',
  'history-stopped': 'Open branch',
} as const satisfies Record<NotificationPlaceReason, string>;

const LABEL_BY_REASON: ReadonlyMap<string, string> = new Map(Object.entries(LABEL));

const REQUEST_REASONS: ReadonlySet<string> = new Set([
  'changes-requested',
  'pr-approved',
  'pr-opened',
]);

const FIX_REASONS: ReadonlySet<string> = new Set(['fix-needs-you', 'fix-couldnt-fix']);

type Params = {
  readonly reason: string | null;
  readonly host?: PullRequestHost;
  readonly place?: PlaceRequest | null;
};

type PlaceParams = {
  readonly place: PlaceRequest | null;
};

const isFilesPlace = ({ place }: PlaceParams): boolean => {
  if (place === null || place.at !== 'session') {
    return false;
  }
  const target = place.view.target;
  return target !== null && target.kind === 'branch' && target.tab === 'files';
};

export const attentionPlaceLabelOf = ({
  reason,
  host = 'github',
  place = null,
}: Params): string => {
  if (reason === null) {
    return SESSION_LABEL;
  }
  if (REQUEST_REASONS.has(reason)) {
    return `Open ${requestNounLabel({ host }).toLowerCase()}`;
  }
  if (FIX_REASONS.has(reason) && isFilesPlace({ place })) {
    return `Open ${NAMES.files}`;
  }
  return LABEL_BY_REASON.get(reason) ?? SESSION_LABEL;
};
