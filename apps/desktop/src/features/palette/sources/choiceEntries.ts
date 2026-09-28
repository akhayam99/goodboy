import type { ObjectTarget, ResolvedAction } from '../../actions/types';
import type { PaletteEntry } from '../types';

export type ChoiceSelectParams = {
  readonly choice: string;
};

type Params = {
  readonly target: ObjectTarget;
  readonly action: ResolvedAction;
  readonly select: (params: ChoiceSelectParams) => void;
};

export const choiceEntries = ({ target, action, select }: Params): ReadonlyArray<PaletteEntry> =>
  (action.choices ?? []).map((choice) => ({
    key: `choice:${action.id}:${choice.id}`,
    label: choice.label,
    kind: 'verb',
    group: 'action',
    icon: action.icon,
    ...(choice.isCurrent && { detail: 'Current' }),
    target,
    run: () => select({ choice: choice.id }),
  }));
