import { useMemo, type ReactNode } from 'react';
import { DEFAULT_WORKFLOW_RULES, type Session, type WorkflowRun } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useRunSpendUsd, useSessionCost } from '../../../../store';
import { runProvidersOf } from '../../runProvidersOf';
import { RunAsksSetting } from './RunAsksSetting';
import { RunLimitSetting } from './RunLimitSetting';
import { RunModelsSetting } from './RunModelsSetting';
import { runSettingsOf } from './runSettingsOf';

type Props = {
  readonly session: Session;
  readonly run: WorkflowRun;
  readonly kind?: ReactNode;
  readonly isOpen: boolean;
};

export const RunSettingsLine = ({ session, run, kind, isOpen }: Props) => {
  const sessionId = session.id;
  const workspaceId = session.workspaceId;
  const workspaceName = useAppStore(
    (state) =>
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? 'the workspace',
  );
  const overrides = useAppStore((state) => state.workspaceOverrides?.[workspaceId] ?? null);
  const sessionCapUsd = useAppStore((state) => state.sessionBudgets[sessionId]?.softCapUsd ?? null);
  const allProviders = useAppStore((state) => state.providers ?? EMPTY_ARRAY);
  const spentUsd = useRunSpendUsd(sessionId, run.id);
  const sessionSpentUsd = useSessionCost(sessionId);
  const policy = overrides?.providerPool ?? null;
  const pool = run.providerPool;
  const providers = useMemo(() => {
    const allowed = runProvidersOf({
      connected: allProviders
        .filter((provider) => provider.connection === 'connected')
        .map((provider) => provider.id),
      policy,
    });
    return allowed.length > 0 ? allowed : (pool ?? []);
  }, [allProviders, policy, pool]);
  const settings = runSettingsOf({
    run,
    workspaceName,
    workspaceAutonomy: overrides?.workflowRules?.autonomy ?? DEFAULT_WORKFLOW_RULES.autonomy,
    sessionCapUsd,
    spentUsd,
    sessionSpentUsd,
    providers,
  });
  return (
    <div
      role="group"
      aria-label="Run settings"
      data-run-settings=""
      className="flex min-w-0 flex-wrap items-center gap-1"
    >
      {kind}
      {isOpen ? <RunAsksSetting sessionId={sessionId} run={run} words={settings.asks} /> : null}
      {isOpen ? <RunLimitSetting sessionId={sessionId} run={run} words={settings.limit} /> : null}
      {isOpen && providers.length > 0 ? (
        <RunModelsSetting
          sessionId={sessionId}
          run={run}
          providers={providers}
          words={settings.models}
        />
      ) : null}
    </div>
  );
};
