import { CHECK_STATE } from '../notifications/errorRecovery';
import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { selectKindRouting } from '../agents/selectKindRouting';
import { TurnRefused } from '../turn/refusal/TurnRefused';
import { turnRefusalOf } from '../turn/refusal/turnRefusalOf';
import { PUSH_FIXER_NAME } from './pushFix/pushFixerName';
import type { GetFn } from './types';

type BindParams = { readonly agentId: AgentId };

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly prompt: string;
  readonly onAccepted?: () => void;
  readonly isStillValid: () => boolean;
  readonly bind: (params: BindParams) => void;
  readonly unbind: (params: BindParams) => void;
};

export const spawnPushFixer = async ({
  get,
  sessionId,
  mountId,
  prompt,
  onAccepted,
  isStillValid,
  bind,
  unbind,
}: Params): Promise<AgentId | null> => {
  const state = get();
  const routing = selectKindRouting({ state, sessionId, kind: 'implementer' });
  const agentId = await state.spawnAgent(sessionId, {
    name: PUSH_FIXER_NAME,
    kindOverride: 'implementer',
    ...routing,
    initialPrompt: prompt,
    mountId,
    focus: 'none',
    shouldDeferKickoff: true,
  });
  if (!isStillValid()) {
    await get()
      .deleteAgent(sessionId, agentId)
      .catch((error: unknown) => {
        void get().reportError({
          recovery: CHECK_STATE,
          title: "Couldn't remove the push fixer",
          error,
          sessionId,
        });
      });
    return null;
  }
  bind({ agentId });
  const dropFix = async (): Promise<void> => {
    unbind({ agentId });
    await get()
      .deleteAgent(sessionId, agentId)
      .catch((error: unknown) => {
        void get().reportError({
          recovery: CHECK_STATE,
          title: "Couldn't remove the push fixer",
          error,
          sessionId,
        });
      });
  };
  void get()
    .sendTurn({
      sessionId,
      agentId,
      content: prompt,
      mountId,
      ...(onAccepted !== undefined && { onStarted: onAccepted }),
      handoff: { instruction: prompt, plan: null },
    })
    .then(
      async (result) => {
        const refusal = turnRefusalOf({ result });
        if (refusal === null) {
          if (result.isLaneQueued === true) {
            onAccepted?.();
          }
          return;
        }
        await dropFix();
        void get().reportError({
          recovery: CHECK_STATE,
          title: "The agent didn't start",
          error: new TurnRefused({ refusal }),
          sessionId,
        });
      },
      async (error: unknown) => {
        await dropFix();
        void get().reportError({
          recovery: CHECK_STATE,
          title: "The agent didn't start",
          error,
          sessionId,
        });
      },
    );
  return agentId;
};
