import { Chip } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { sessionTitle } from '../../../../../../shared/utils/sessionTitle';

type Props = {
  readonly session: Session;
};

export const AskScope = ({ session }: Props) => (
  <div data-testid="ask-scope" className="flex min-w-0">
    <Chip
      kind="state"
      tone="neutral"
      label={`Scope: ${sessionTitle({ session })}`}
      ariaLabel={`Scope: ${sessionTitle({ session })}`}
    />
  </div>
);
