import type { AutoStuckKind } from './autoStuckKindOf';
import { autoStuckVerbOf } from './autoStuckVerbOf';

type Params = {
  readonly title: string;
  readonly kind: AutoStuckKind;
};

export const autoStuckLineOf = ({ title, kind }: Params): string =>
  `"${title}" ${autoStuckVerbOf({ kind })}`;
