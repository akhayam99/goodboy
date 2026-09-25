import { useCurrentSession } from '../../../../store';
import { SessionCrumbs } from './SessionCrumbs';

export const SessionCrumbBar = () => {
  const currentSession = useCurrentSession();

  if (!currentSession) {
    return null;
  }
  return <SessionCrumbs key={currentSession.id} session={currentSession} />;
};
