import { listenAgentTurnChanges } from '../features/permissions/listenAgentTurnChanges';
import { listenSessionFactChanges } from '../features/session/listenSessionFactChanges';
import { listenSettingChanges } from '../features/settings/listenSettingChanges';

export const listenWindowFacts = async (): Promise<() => void> => {
  const stops = await Promise.all([
    listenSettingChanges(),
    listenAgentTurnChanges(),
    listenSessionFactChanges(),
  ]);
  return () => {
    for (const stop of stops) {
      stop();
    }
  };
};
