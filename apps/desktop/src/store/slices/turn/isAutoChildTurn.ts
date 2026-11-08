import type { SendTurnInput } from './types';
import { AUTO_CONFINED_ROLE } from './confinedRoleOf';
import type { ChildTurn } from './childTurn/resolveChildTurn';

type Params = Readonly<{
  input: Pick<SendTurnInput, 'origin'>;
  confinedRole: string | undefined;
  childTurn: ChildTurn | null;
}>;

export const isAutoChildTurn = ({ input, confinedRole, childTurn }: Params): boolean =>
  childTurn !== null ||
  (input.origin === 'delegation' &&
    confinedRole !== undefined &&
    confinedRole !== AUTO_CONFINED_ROLE);
