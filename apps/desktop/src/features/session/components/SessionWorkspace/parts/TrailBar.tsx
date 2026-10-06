import type { ReactNode } from 'react';
import type { Session } from '@goodboy/types';
import { PageColumn } from '@goodboy/ui';
import { SessionCrumbs } from '../../SessionTrail/SessionCrumbs';

type Props = {
  readonly session: Session;
  readonly width?: 'column' | 'full';
  readonly end?: ReactNode;
};

export const TrailBar = ({ session, width = 'column', end }: Props) => (
  <div data-slot="trail-bar" className="flex h-10 shrink-0 items-start pb-1 pt-3">
    <PageColumn width={width} className="flex h-6 min-w-0 items-center">
      <SessionCrumbs session={session} />
    </PageColumn>
    {end === undefined ? null : (
      <div data-slot="trail-end" className="flex h-6 shrink-0 items-center pr-3">
        {end}
      </div>
    )}
  </div>
);
