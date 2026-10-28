import type { ReactNode, RefCallback } from 'react';
import type { AutoBudgetFacts } from '@goodboy/core';
import type { AutoTreeId, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useAutoTreeLimit } from '../../../auto/useAutoTreeLimit';
import { pausingSessionCapOf } from '../../../budget/pausingSessionCapOf';
import { AutoLimitSetting } from './AutoLimitSetting';
import { autoLimitWordsOf } from './autoLimitWordsOf';
import { SessionLimitSetting } from './SessionLimitSetting';

type AutoBudget = Readonly<{
  treeId: AutoTreeId;
  facts: AutoBudgetFacts;
}>;

type Props = {
  readonly session: Session;
  readonly kind: ReactNode;
  readonly auto: AutoBudget | null;
  readonly asksSlotRef: RefCallback<HTMLElement>;
  readonly modelsSlotRef: RefCallback<HTMLElement>;
};

export const AgentSettingsLine = ({ session, kind, auto, asksSlotRef, modelsSlotRef }: Props) => {
  const sessionId = session.id;
  const workspaceId = session.workspaceId;
  const workspaceName = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? 'the workspace',
  );
  const sessionCapUsd = useAppStore((state) =>
    pausingSessionCapOf({ budget: state.sessionBudgets[sessionId] }),
  );
  const workspaceLimitUsd = useAutoTreeLimit({ workspaceId }).usd;
  return (
    <div
      role="group"
      aria-label="Run settings"
      data-agent-settings=""
      className="flex min-w-0 flex-wrap items-center gap-1"
    >
      {kind}
      <span ref={asksSlotRef} data-settings-slot="asks" className="inline-flex empty:hidden" />
      {auto === null ? (
        <SessionLimitSetting sessionId={sessionId} />
      ) : (
        <AutoLimitSetting
          sessionId={sessionId}
          treeId={auto.treeId}
          facts={auto.facts}
          sessionCapUsd={sessionCapUsd}
          words={autoLimitWordsOf({
            facts: auto.facts,
            sessionCapUsd,
            workspaceLimitUsd,
            workspaceName,
          })}
        />
      )}
      <span
        ref={modelsSlotRef}
        data-settings-slot="models"
        className="inline-flex items-center gap-1 empty:hidden"
      />
    </div>
  );
};
