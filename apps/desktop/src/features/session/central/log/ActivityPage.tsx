import { PaneShell } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { LogPane } from './LogPane';

type Props = {
  readonly session: Session;
};

export const ActivityPage = ({ session }: Props) => (
  <PaneShell page="activity">
    <LogPane session={session} />
  </PaneShell>
);
