import type { SendTurnInput } from './types';
import { AUTO_CONFINED_ROLE } from './confinedRoleOf';

type Params = Readonly<{
  input: Pick<SendTurnInput, 'origin'>;
  confinedRole: string | undefined;
}>;

export const isAutoChildTurn = ({ input, confinedRole }: Params): boolean =>
  input.origin === 'delegation' &&
  confinedRole !== undefined &&
  confinedRole !== AUTO_CONFINED_ROLE;
