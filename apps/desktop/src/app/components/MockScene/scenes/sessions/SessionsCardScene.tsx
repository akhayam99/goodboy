import { useAppStore } from '../../../../../store';
import { SessionColumnScene } from './SessionColumnScene';

const showSessionsCard = (): boolean => {
  useAppStore.setState({ sessionsCardPhase: 'open' });
  return true;
};

export const SessionsCardScene = () => (
  <SessionColumnScene isArchivedShown={false} run={showSessionsCard} />
);
