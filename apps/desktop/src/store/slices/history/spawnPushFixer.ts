import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { selectKindRouting } from '../agents/selectKindRouting';
import type { SendTurnResult } from '../turn/types';
import type { GetFn } from './types';

const PUSH_FIXER_NAME = 'Fix the push';

type RefusalParams = {
  readonly result: SendTurnResult;
};

const refusalOf = ({ result }: RefusalParams): string | null => {
  if (result.blockedOverBudget) {
    return 'The session budget is reached. Raise it to start the fix';
  }
  if (result.isWriterLeaseDenied === true) {
    return 'Another agent is writing in this folder. Try again in a moment';
  }
  return null;
};

type BindParams = { readonly agentId: AgentId };

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly prompt: string;
  readonly isStillValid: () => boolean;
  readonly bind: (params: BindParams) => void;
  readonly unbind: (params: BindParams) => void;
};

export const spawnPushFixer = async ({
  get,
  sessionId,
  mountId,
  prompt,
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
        void get().reportError({ title: "Couldn't remove the push fixer", error, sessionId });
      });
    return null;
  }
  bind({ agentId });
  const dropFix = async (): Promise<void> => {
    unbind({ agentId });
    await get()
      .deleteAgent(sessionId, agentId)
      .catch((error: unknown) => {
        void get().reportError({ title: "Couldn't remove the push fixer", error, sessionId });
      });
  };
  void get()
    .sendTurn({
      sessionId,
      agentId,
      content: prompt,
      mountId,
      handoff: { instruction: prompt, plan: null },
    })
    .then(
      async (result) => {
        const refusal = refusalOf({ result });
        if (refusal === null) {
          return;
        }
        await dropFix();
        void get().reportError({
          title: "The agent didn't start",
          error: new Error(refusal),
          sessionId,
        });
      },
      async (error: unknown) => {
        await dropFix();
        void get().reportError({ title: "The agent didn't start", error, sessionId });
      },
    );
  return agentId;
};
