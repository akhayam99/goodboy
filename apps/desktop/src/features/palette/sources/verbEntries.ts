import { formerNamesOf } from '../../../shared/utils/names';
import type { ObjectTarget, ResolvedAction } from '../../actions/types';
import type { PaletteEntry } from '../types';

export type VerbSelectParams = {
  readonly action: ResolvedAction;
};

type Params = {
  readonly target: ObjectTarget;
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly isScope: boolean;
  readonly noun: string;
  readonly select: (params: VerbSelectParams) => void;
};

const verbKey = (actionId: string): string => `verb:${actionId}`;

const PROPER_NOUNS: ReadonlySet<string> = new Set([
  'Linear',
  'Sentry',
  'Jira',
  'Slack',
  'GitHub',
  'GitLab',
  'Bitbucket',
]);

type NounParams = {
  readonly noun: string;
};

const sentenceNoun = ({ noun }: NounParams): string =>
  PROPER_NOUNS.has(noun) ? noun : `${noun.charAt(0).toLowerCase()}${noun.slice(1)}`;

const verbLabel = ({ action }: VerbSelectParams): string =>
  action.ariaLabel ??
  (action.group === 'open' && !action.label.includes(' ') && action.label !== 'Open'
    ? `Open ${sentenceNoun({ noun: action.label })}`
    : action.label);

export const verbEntries = ({
  target,
  actions,
  isScope,
  noun,
  select,
}: Params): ReadonlyArray<PaletteEntry> =>
  actions.map((action) => ({
    key: verbKey(action.id),
    label: verbLabel({ action }),
    secondary: [noun, ...formerNamesOf(action.label)],
    kind: 'verb',
    group: 'action',
    icon: action.icon,
    ...(action.blockedReason !== null && { detail: action.blockedReason }),
    ...(action.shortcut !== null && { shortcut: action.shortcut }),
    isScopeVerb: isScope,
    isBlocked: action.blockedReason !== null,
    target,
    action,
    run: () => select({ action }),
  }));
