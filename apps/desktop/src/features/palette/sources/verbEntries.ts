import type { ObjectTarget, ResolvedAction } from '../interimActions/types';
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

export const verbKey = (actionId: string): string => `verb:${actionId}`;

export const verbLabel = ({ action }: VerbSelectParams): string =>
  action.group === 'open' && !action.label.startsWith('Open')
    ? `Open ${action.label}`
    : action.label;

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
    secondary: [noun],
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
