import { useCallback } from 'react';
import type { AgentId, Session, TurnProviderOverride } from '@goodboy/types';
import { resolveStoredModelSelection } from '@goodboy/core';
import {
  toStoredAttachment,
  type PendingAttachment,
} from '../../../../../attachments/pendingAttachment';
import type { QueuedTurn } from '../../lib';
import type { useRightSizeNudge } from '../useRightSizeNudge';
import type { useScopeNudge } from '../useScopeNudge';
import type { useTurnDispatch } from '../useTurnDispatch';
import type { useTurnRouting } from '../useTurnRouting';

export type RunningDelivery = 'queue' | 'now';

export type SendWith = (params: {
  readonly content: string;
  readonly atts: ReadonlyArray<PendingAttachment>;
  readonly modelOverrideId: string | null;
  readonly force?: boolean;
  readonly delivery?: RunningDelivery;
}) => Promise<void>;

type Params = {
  readonly session: Session;
  readonly providerDisconnected: boolean;
  readonly selectedAgentId: AgentId | null;
  readonly isRunning: boolean;
  readonly value: string;
  readonly setValue: (next: string) => void;
  readonly attachments: ReadonlyArray<PendingAttachment>;
  readonly setAttachments: (next: ReadonlyArray<PendingAttachment>) => void;
  readonly routing: ReturnType<typeof useTurnRouting>;
  readonly dispatch: ReturnType<typeof useTurnDispatch>;
  readonly scope: ReturnType<typeof useScopeNudge>;
  readonly rightSize: ReturnType<typeof useRightSizeNudge>;
  readonly enqueue: (turn: QueuedTurn) => void;
  readonly sendNow: (turn: QueuedTurn) => void;
};

export const useComposerSend = ({
  session,
  providerDisconnected,
  selectedAgentId,
  isRunning,
  value,
  setValue,
  attachments,
  setAttachments,
  routing,
  dispatch,
  scope,
  rightSize,
  enqueue,
  sendNow,
}: Params) => {
  const sendWith = useCallback<SendWith>(
    async ({ content, atts, modelOverrideId, force = false, delivery = 'queue' }) => {
      const override: TurnProviderOverride | undefined = routing.allowOverride
        ? modelOverrideId == null
          ? routing.routingOverride
          : {
              providerId: routing.effectiveProvider,
              model: modelOverrideId,
              selection: resolveStoredModelSelection({
                provider: routing.effectiveProvider,
                id: modelOverrideId,
                effort: routing.effectiveEffort,
              }).selection,
            }
        : undefined;

      if (isRunning) {
        if (selectedAgentId == null) {
          return;
        }
        const turn = {
          id: crypto.randomUUID(),
          agentId: selectedAgentId,
          content,
          attachments: await Promise.all(atts.map(toStoredAttachment)),
          override,
        };
        if (delivery === 'now') {
          sendNow(turn);
          return;
        }
        enqueue(turn);
        return;
      }

      if (selectedAgentId == null) {
        return;
      }
      const result = await dispatch.dispatchTurn({
        content,
        atts,
        override,
        agentId: selectedAgentId,
        force,
      });
      if (!result.blockedOverBudget) {
        return;
      }
      setValue(content);
      setAttachments(atts);
    },
    [
      routing.allowOverride,
      routing.effectiveProvider,
      routing.effectiveEffort,
      routing.routingOverride,
      isRunning,
      selectedAgentId,
      enqueue,
      sendNow,
      dispatch.dispatchTurn,
      setValue,
      setAttachments,
    ],
  );

  const submitDraft = async ({
    force,
    delivery = 'queue',
  }: {
    readonly force: boolean;
    readonly delivery?: RunningDelivery;
  }) => {
    const content = value.trim();
    const atts = attachments;
    if ((!content && atts.length === 0) || providerDisconnected || session.archivedAt != null) {
      return;
    }
    dispatch.setError(null);
    dispatch.setLastFailedTurn(null);

    if (!force) {
      if (await scope.checkAndInterceptScope(content, atts)) {
        return;
      }
      if (!isRunning && (await rightSize.checkAndInterceptRightSize(content, atts))) {
        return;
      }
    }

    if (force && scope.scopePending !== null) {
      scope.setScopePending(null);
      await scope.recordScopeOutcome('overridden');
    }
    if (force && rightSize.rightSizePending !== null) {
      rightSize.setRightSizePending(null);
      await rightSize.recordRightSizeOutcome({ outcome: 'overridden' });
    }

    setValue('');
    setAttachments([]);
    await sendWith({ content, atts, modelOverrideId: null, force, delivery });
  };

  const onSend = async () => submitDraft({ force: false });

  const onSendNow = async () => submitDraft({ force: false, delivery: 'now' });

  const onSendAnyway = async () => submitDraft({ force: true });

  return { sendWith, onSend, onSendNow, onSendAnyway };
};
