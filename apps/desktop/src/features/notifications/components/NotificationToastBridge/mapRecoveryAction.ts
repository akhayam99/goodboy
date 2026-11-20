import { OPEN_FAILED } from '../../../../store/slices/notifications/errorRecovery';
import type { NotificationAction } from '@goodboy/db';
import type { useAppStore } from '../../../../store';
import type { ToastAction } from '../../../../shared/components/Toast';
import { revealInFileManager } from '../../../../shared/lib/reveal';
import { integrationLabel } from '../../../../shared/utils/integrationLabel';
import { NAMES } from '../../../../shared/utils/names';
import { revealLabelOf } from '../../../../shared/utils/revealLabelOf';
import { connectionFocusOf } from '../../../connections/connectionFocusOf';
import { openConnection } from '../../../connections/openConnection';
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
    if (tool !== undefined) {
      return {
        label: `Reconnect ${integrationLabel({ provider: tool })}`,
        onClick: () => openConnection({ focus: { kind: 'tool', tool } }),
      };
    }
    if (scope === 'providers' || scope === 'tools') {
      return {
        label: `Open ${NAMES.connections}`,
        onClick: () => openConnection({ focus: connectionFocusOf({ provider }) }),
      };
    }
    return {
      label: NAMES.openSettings,
      onClick: () => openSettings({ scope, ...(section !== undefined && { section }) }),
    };
  }
  if (action.kind === 'reveal-path') {
    const { path } = action;
    return {
      label: revealLabelOf(),
      onClick: () => {
        revealInFileManager({ path }).catch((error: unknown) => {
          void store.reportError({
            recovery: OPEN_FAILED,
            title: "Couldn't show the folder",
            error,
          });
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
