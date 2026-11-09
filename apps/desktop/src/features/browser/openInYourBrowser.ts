import { useAppStore } from '../../store';
import { OPEN_FAILED } from '../../store/slices/notifications/errorRecovery';
import { openUrl } from '../../shared/lib/editor';
import { hostOf } from './hostOf';

type Params = {
  readonly url: string;
};

export const openInYourBrowser = ({ url }: Params): Promise<void> =>
  openUrl(url).catch((error: unknown) =>
    useAppStore.getState().reportError({
      recovery: OPEN_FAILED,
      title: `Couldn't open ${hostOf({ url })}`,
      error,
    }),
  );
