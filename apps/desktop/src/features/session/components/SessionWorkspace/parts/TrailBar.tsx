import type { Session } from '@goodboy/types';
import { PageColumn } from '@goodboy/ui';
import { SessionCrumbs } from '../../SessionTrail/SessionCrumbs';

type Props = {
  readonly session: Session;
};

export const TrailBar = ({ session }: Props) => (
  <div data-slot="trail-bar" className="h-10 shrink-0 pb-1 pt-3">
    <PageColumn className="flex h-6 min-w-0 items-center">
      <SessionCrumbs session={session} />
    </PageColumn>
  </div>
);
