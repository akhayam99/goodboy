import { listenAgentTurnChanges } from '../features/permissions/listenAgentTurnChanges';
import { listenSettingChanges } from '../features/settings/listenSettingChanges';

export const listenWindowFacts = async (): Promise<() => void> => {
  const stops = await Promise.all([listenSettingChanges(), listenAgentTurnChanges()]);
  return () => {
    for (const stop of stops) {
      stop();
    }
  };
};
