import { relaunchWithResume } from './prepareRestart';

export const relaunchApp = () => {
  return async (): Promise<void> => {
    await relaunchWithResume({ reason: 'restart' });
  };
};
