import { invokeCommand } from '../../../shared/lib/invokeCommand';

let known: number | null = null;

export const processLaunchStampOf = async (): Promise<number | null> => {
  if (known !== null) {
    return known;
  }
  const stamp = await invokeCommand<unknown>('process_launch_stamp').then(
    (value) => value,
    () => null,
  );
  if (typeof stamp !== 'number' || !Number.isFinite(stamp)) {
    return null;
  }
  known = stamp;
  return stamp;
};
