import type { NotificationAction } from '@goodboy/db';
import type { useAppStore } from '../../../../store';
import type { ToastAction } from '../../../../shared/components/Toast';
import { revealInFileManager } from '../../../../shared/lib/reveal';
import { integrationLabel } from '../../../../shared/utils/integrationLabel';
import { NAMES } from '../../../../shared/utils/names';
import { openSettings } from '../../../settings/openSettings';
import { retryNotifiedPush } from '../../retryNotifiedPush';

type RecoveryAction = Extract<
  NotificationAction,
  { kind: 'open-settings' | 'reveal-path' | 'retry-push' }
>;

type Params = {
  readonly action: RecoveryAction;
  readonly store: ReturnType<typeof useAppStore.getState>;
};

export const mapRecoveryAction = ({ action, store }: Params): ToastAction => {
  if (action.kind === 'open-settings') {
    const { scope, section, provider, tool } = action;
    return {
      label:
        tool === undefined
          ? NAMES.openSettings
          : `Reconnect ${integrationLabel({ provider: tool })}`,
      onClick: () => {
        openSettings({
          scope,
          ...(section !== undefined && { section }),
          ...(provider !== undefined && { provider }),
          ...(tool !== undefined && { tool }),
        });
      },
    };
  }
  if (action.kind === 'reveal-path') {
    const { path } = action;
    return {
      label: NAMES.showInFinder,
      onClick: () => {
        revealInFileManager({ path }).catch((error: unknown) => {
          void store.reportError({ title: "Couldn't show the folder", error });
        });
      },
    };
  }
  const { sessionId, mountId } = action;
  return {
    label: NAMES.retryPush,
    onClick: () => {
      void retryNotifiedPush({ store, sessionId, mountId });
    },
  };
};
