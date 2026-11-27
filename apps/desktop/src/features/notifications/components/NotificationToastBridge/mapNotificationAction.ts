import type { Notification } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import { sessionPlace, useAppStore } from '../../../../store';
import type { ToastAction } from '../../../../shared/components/Toast';
import type { ImpactScope } from '../../../impact/lib';
import { openImpactStudio } from '../../../impact/openImpactStudio';
import { CLI_LABEL } from '../../../providers/cliLabel';
import { openProviderCliUpdate } from '../../../providers/openProviderCliUpdate';
import { openStorage } from '../../../storage/openStorage';
import { mapAgentAction } from './mapAgentAction';
import { mapRecoveryAction } from './mapRecoveryAction';
import { attentionPlaceLabelOf } from '../../../session/attentionPlaceLabel';
import { mapOpenPlaceAction } from './mapOpenPlaceAction';
import { openToolPane } from '../../../session/panes/openToolPane';
import { mapRetryAction } from './mapRetryAction';

type Params = {
  readonly store?: ReturnType<typeof useAppStore.getState>;
  readonly notification: Notification;
};

export const mapNotificationAction = ({
  store = useAppStore.getState(),
  notification,
}: Params): ToastAction | undefined => {
  const { action } = notification;
  if (action == null) {
    return undefined;
  }
  if (action.kind === 'retry-summarizer') {
    const { sessionId } = action;
    const lastAttempt = store.summarizerStatus[sessionId]?.lastAttempt;
    if (lastAttempt == null) {
      return undefined;
    }
    return {
      label: 'Retry',
      onClick: () => {
        store.retrySummarizer(sessionId);
      },
    };
  }
  if (action.kind === 'retry-orchestrator') {
    const { sessionId, workflowRunId } = action;
    return {
      label: 'Retry',
      onClick: () => {
        void store.orchestrateNextStep(sessionId, workflowRunId, { bypassGate: true });
      },
    };
  }
  if (action.kind === 'retry-step-summary') {
    const { sessionId, agentId } = action;
    return {
      label: 'Retry',
      onClick: () => {
        void store.retryStepSummary({ sessionId, agentId });
      },
    };
  }
  if (action.kind === 'open-activity') {
    const { sessionId } = action;
    return {
      label: attentionPlaceLabelOf({ reason: null }),
      onClick: () => {
        store.navigate({ to: sessionPlace({ sessionId, lens: null }) });
      },
    };
  }
  if (action.kind === 'open-place') {
    return mapOpenPlaceAction({ action, store, notification });
  }
  if (action.kind === 'continue-agent' || action.kind === 'open-agent') {
    return mapAgentAction({ action, store });
  }
  if (action.kind === 'open-budget') {
    const scope: ImpactScope =
      action.sessionId != null
        ? { kind: 'session', sessionId: action.sessionId }
        : { kind: 'overview' };
    return {
      label: 'Open spend',
      onClick: () => {
        openImpactStudio({ scope });
      },
    };
  }
  if (action.kind === 'retry-publication') {
    const { sessionId } = action;
    return {
      label: 'Check and retry',
      onClick: () => {
        void (async () => {
          const preview = await store.retryPublication({ sessionId, mountId: null });
          if (preview.publicationId === null) {
            return;
          }
          await store.publishConversations({
            sessionId,
            publicationId: preview.publicationId,
          });
        })().catch((err: unknown) => {
          void store.emitNotification({
            kind: 'error',
            severity: 'error',
            title: 'Retry failed, the conversations stay open',
            body: formatError(err),
            sessionId,
          });
        });
      },
    };
  }
  if (action.kind === 'open-orphan-worktrees') {
    const { workspaceId } = action;
    return {
      label: 'Review storage',
      onClick: () => openStorage({ scope: { kind: 'workspace', id: workspaceId } }),
    };
  }
  if (action.kind === 'open-storage') {
    const { filter, workspaceId } = action;
    return {
      label: 'Review storage',
      onClick: () =>
        openStorage({
          filter: filter ?? 'review',
          scope: workspaceId == null ? { kind: 'all' } : { kind: 'workspace', id: workspaceId },
        }),
    };
  }
  if (action.kind === 'retry-update') {
    return {
      label: 'Retry',
      onClick: () => {
        void store.applyUpdate();
      },
    };
  }
  if (action.kind === 'retry-notification-scope') {
    const { scope } = action;
    return {
      label: 'Retry',
      onClick: () => {
        void store.setNotificationScope(scope);
      },
    };
  }
  if (action.kind === 'update-provider-cli') {
    const { providerId } = action;
    return {
      label: `Update ${CLI_LABEL[providerId]}`,
      onClick: () => {
        openProviderCliUpdate({ providerId });
      },
    };
  }
  if (action.kind === 'open-lens') {
    const { sessionId, lens } = action;
    return {
      label: 'Show output',
      onClick: () => {
        openToolPane({ sessionId, pane: lens });
      },
    };
  }
  if (action.kind === 'retry-action') {
    return mapRetryAction({ action, store, notification });
  }
  if (
    action.kind === 'open-settings' ||
    action.kind === 'reveal-path' ||
    action.kind === 'retry-push'
  ) {
    return mapRecoveryAction({ action, store });
  }
  const _exhaustive: never = action;
  return undefined;
};
