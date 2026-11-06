import { useEffect } from 'react';
import { useAppStore } from '../../../../store';
import { useShowToast } from '../../../../shared/components/Toast/useShowToast';
import { ATTENTION_HANDLED_EVENT } from '../../attentionHandledEvent';
import { attentionTargetChannel } from '../../attentionTargetChannel';
import { landAttentionTarget } from '../../landAttentionTarget';

type TakeParams = {
  readonly isFreshOpen: boolean;
};

const takeAndLand = ({ isFreshOpen }: TakeParams): void => {
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId;
  if (workspaceId === null || !state.boardReady || state.switchingToWorkspaceId !== null) {
    return;
  }
  const target = attentionTargetChannel.take({ workspaceId, now: Date.now() });
  if (target === null) {
    return;
  }
  landAttentionTarget({ target, isFreshOpen });
};

export const useAttentionTargets = (): void => {
  const showToast = useShowToast();
  const isReady = useAppStore(
    (state) =>
      state.currentWorkspaceId !== null &&
      state.boardReady &&
      state.switchingToWorkspaceId === null,
  );

  useEffect(() => {
    if (isReady) {
      takeAndLand({ isFreshOpen: true });
    }
  }, [isReady]);

  useEffect(() => {
    const onHandled = (): void => showToast({ kind: 'info', message: 'Already handled' });
    globalThis.addEventListener(ATTENTION_HANDLED_EVENT, onHandled);
    return () => globalThis.removeEventListener(ATTENTION_HANDLED_EVENT, onHandled);
  }, [showToast]);

  useEffect(() => {
    let off: () => void = () => undefined;
    let isLive = true;
    attentionTargetChannel
      .listen({ onTarget: () => takeAndLand({ isFreshOpen: false }) })
      .then((unlisten) => {
        if (!isLive) {
          unlisten();
          return;
        }
        off = unlisten;
      })
      .catch((error: unknown) => {
        void useAppStore
          .getState()
          .reportError({ title: "Couldn't listen for notification clicks", error });
      });
    return () => {
      isLive = false;
      off();
    };
  }, []);
};
