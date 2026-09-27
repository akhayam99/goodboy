const SEPARATOR = ' › ';

const STUDIO_JOINER = ' · ';

const UNKNOWN_SCREEN = 'Unknown';

const LENS_LABELS: Readonly<Record<string, string>> = {
  questions: 'Questions',
  agents: 'Agents',
  workflows: 'Workflows',
  review: 'Review',
  artifacts: 'Artifacts',
  scripts: 'Scripts',
  terminal: 'Terminal',
  context: 'Context',
  pr: 'Pull request',
  diff: 'Diff',
  explore: 'Explore',
  linear: 'Linear',
  gitlab: 'GitLab',
  jira: 'Jira',
  'github-issue': 'GitHub issue',
  slack: 'Slack',
};

const CONTEXT_TAB_LABELS: Readonly<Record<string, string>> = {
  goal: 'Goal',
  decisions: 'Decisions',
  summary: 'Summary',
};

const SESSION_STUDIO_LABELS: Readonly<Record<string, string>> = {
  edit: 'Workflow editor',
  mr: 'Merge request',
  bitbucket: 'Bitbucket',
};

const APP_STUDIO_LABELS: Readonly<Record<string, string>> = {
  settings: 'Settings',
  inbox: 'Inbox',
  impact: 'Impact',
  workflows: 'Workflows',
  'add-workspace': 'Add workspace',
  guide: 'Guide',
  companion: 'Companion',
  changelog: 'Changelog',
  notifications: 'Notifications',
};

const SETTINGS_SCOPE_LABELS: Readonly<Record<string, string>> = {
  app: 'App',
  workspace: 'Workspace',
  providers: 'Providers',
  tools: 'Tools',
};

const INBOX_PROVIDER_LABELS: Readonly<Record<string, string>> = {
  github: 'GitHub',
  gitlab: 'GitLab',
  linear: 'Linear',
  jira: 'Jira',
  sentry: 'Sentry',
  slack: 'Slack',
  bitbucket: 'Bitbucket',
};

const STUDIO_DETAIL_LABELS: Readonly<Partial<Record<string, Readonly<Record<string, string>>>>> = {
  settings: SETTINGS_SCOPE_LABELS,
  inbox: INBOX_PROVIDER_LABELS,
};

type LookupParams = {
  readonly labels: Readonly<Record<string, string>>;
  readonly token: string | undefined;
};

const lookup = ({ labels, token }: LookupParams): string | null =>
  token !== undefined && Object.hasOwn(labels, token) ? (labels[token] ?? null) : null;

type SegmentsParams = {
  readonly segments: ReadonlyArray<string>;
};

const sessionLabels = ({ segments }: SegmentsParams): ReadonlyArray<string> => {
  const lens = lookup({ labels: LENS_LABELS, token: segments[2] });
  const contextTab =
    segments[2] === 'context' ? lookup({ labels: CONTEXT_TAB_LABELS, token: segments[3] }) : null;
  const studio =
    segments.length > 2 ? lookup({ labels: SESSION_STUDIO_LABELS, token: segments.at(-1) }) : null;
  return ['Session', lens, contextTab, studio].filter((label): label is string => label !== null);
};

const placeLabels = ({ segments }: SegmentsParams): ReadonlyArray<string> => {
  if (segments[0] === 'board') {
    return ['Board'];
  }
  if (segments[0] === 'new') {
    return ['New session'];
  }
  if (segments[0] === 's') {
    return sessionLabels({ segments });
  }
  return [];
};

const studioLabels = ({ segments }: SegmentsParams): ReadonlyArray<string> => {
  const studio = lookup({ labels: APP_STUDIO_LABELS, token: segments[0] });
  if (studio === null) {
    return [];
  }
  const detailLabels = STUDIO_DETAIL_LABELS[segments[0] ?? ''];
  const detail =
    detailLabels === undefined ? null : lookup({ labels: detailLabels, token: segments[1] });
  return detail === null ? [studio] : [studio, detail];
};

type SplitParams = {
  readonly key: string;
};

type SplitKey = {
  readonly place: string;
  readonly studio: string | null;
};

const splitKey = ({ key }: SplitParams): SplitKey => {
  const plus = key.lastIndexOf('+');
  if (plus === -1) {
    return { place: key, studio: null };
  }
  const studio = key.slice(plus + 1);
  const first = studio.split('/')[0];
  if (lookup({ labels: APP_STUDIO_LABELS, token: first }) === null) {
    return { place: key, studio: null };
  }
  return { place: key.slice(0, plus), studio };
};

type ScreenLabelParams = {
  readonly locationKey: string;
};

export const screenLabel = ({ locationKey }: ScreenLabelParams): string => {
  const { place, studio } = splitKey({ key: locationKey });
  const placePart = placeLabels({ segments: place.split('/') }).join(SEPARATOR);
  const studioPart =
    studio === null ? '' : studioLabels({ segments: studio.split('/') }).join(SEPARATOR);
  const parts = [placePart, studioPart].filter((part) => part !== '');
  return parts.length === 0 ? UNKNOWN_SCREEN : parts.join(STUDIO_JOINER);
};
