import { invokeCommand } from './invokeCommand';

const known: { launchId: string | null } = { launchId: null };

export const readLaunchId = async (): Promise<string | null> => {
  if (known.launchId !== null) {
    return known.launchId;
  }
  const launchId = await invokeCommand<string>('turn_launch_id').catch((error: unknown) => {
    console.warn('read the app launch id failed', error);
    return null;
  });
  if (typeof launchId === 'string' && launchId !== '') {
    known.launchId = launchId;
  }
  return known.launchId;
};
