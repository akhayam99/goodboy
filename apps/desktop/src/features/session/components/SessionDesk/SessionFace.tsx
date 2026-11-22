import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { SessionOverviewPane } from '../SessionOverviewPane';
import { SessionDesk } from '.';

type Props = {
  readonly session: Session;
};

export const SessionFace = ({ session }: Props) => {
  const face = useAppStore((state) => state.sessionFace[session.id] ?? 'overview');
  return face === 'desk' ? (
    <SessionDesk session={session} />
  ) : (
    <SessionOverviewPane session={session} />
  );
};
