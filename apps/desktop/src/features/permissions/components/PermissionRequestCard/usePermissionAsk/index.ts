import { CHECK_STATE } from '../../../../../store/slices/notifications/errorRecovery';
import { useState } from 'react';
import { isFilePathTool, prefixRuleFor } from '@goodboy/core/permissions';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { useAskerNoun } from '../../../../../store/hooks/useAskerNoun';
import { modeCopyOf } from '../../../modeCopy';
import type { OpenPermissionAsk } from '../../../openPermissionAsksOf';
import { permissionAskTitleOf } from '../../../permissionAskTitleOf';

type Params = {
  readonly item: OpenPermissionAsk;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
  readonly isDocked: boolean;
  readonly onAnswered: () => void;
};

type ScopeParams = {
  readonly scope: 'workspace' | 'global';
};

type ReasonParams = {
  readonly reason: string;
};

type BusyParams = {
  readonly action: () => Promise<void>;
};

const ASK_SETTLE_MS = 400;

export const usePermissionAsk = ({ item, sessionId, agentId, isDocked, onAnswered }: Params) => {
  const [shownAt] = useState(() => Date.now());
  const [isResolved, setIsResolved] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const session = useAppStore((state) =>
    sessionId === null ? null : (sessionById(state.sessions, sessionId) ?? null),
  );
  const askerNoun = useAskerNoun({ sessionId, agentId });
  const workspaceName = useAppStore(
    (state) => state.workspaces.find((w) => w.id === session?.workspaceId)?.name ?? null,
  );
  const allowAndContinue = useAppStore((state) => state.allowAndContinue);
  const allowWithRule = useAppStore((state) => state.allowWithRule);
  const neverAllowTool = useAppStore((state) => state.neverAllowTool);
  const denyWithReason = useAppStore((state) => state.denyWithReason);
  const reportError = useAppStore((state) => state.reportError);

  const rule = prefixRuleFor({ toolName: item.toolName, input: item.input });
  const place = workspaceName === null ? rule.label : `${rule.label} in ${workspaceName}`;
  const { toolUseId, toolName, runId } = item;

  const withBusy = async ({ action }: BusyParams): Promise<void> => {
    if (isBusy || (isDocked && Date.now() - shownAt < ASK_SETTLE_MS)) {
      return;
    }
    setIsBusy(true);
    try {
      await action();
      onAnswered();
      setIsResolved(true);
    } catch (err) {
      void reportError({
        recovery: CHECK_STATE,
        title: `Couldn't answer the ${toolName} request`,
        error: err,
        sessionId: sessionId ?? undefined,
      });
    } finally {
      setIsBusy(false);
    }
  };

  const target =
    sessionId === null || agentId === null
      ? null
      : { sessionId, agentId, toolUseId, toolName, runId };

  return {
    isBusy,
    isResolved,
    canAct: !isResolved && target !== null,
    askerNoun,
    title: permissionAskTitleOf({ asker: askerNoun ?? 'The agent', toolName }),
    modeLabel: session === null ? null : modeCopyOf({ mode: session.permissionMode }).label,
    ruleLabel: rule.label,
    alwaysAllowLabel: isFilePathTool({ toolName }) ? place : rule.label,
    neverLabel: `Never allow ${rule.subject} in this session`,
    allow: () => {
      if (target !== null) {
        void withBusy({ action: () => allowAndContinue({ ...target, input: item.input }) });
      }
    },
    alwaysAllow: async ({ scope }: ScopeParams): Promise<void> => {
      if (target !== null) {
        await withBusy({
          action: () => allowWithRule({ ...target, scope, pattern: rule.pattern }),
        });
      }
    },
    allowSession: () => {
      if (target !== null) {
        void withBusy({
          action: () => allowWithRule({ ...target, scope: 'session', pattern: { tool: toolName } }),
        });
      }
    },
    neverAllow: () => {
      if (target !== null) {
        void withBusy({ action: () => neverAllowTool({ ...target, pattern: rule.pattern }) });
      }
    },
    deny: ({ reason }: ReasonParams) => {
      if (target !== null) {
        void withBusy({ action: () => denyWithReason({ ...target, reason }) });
      }
    },
  };
};
