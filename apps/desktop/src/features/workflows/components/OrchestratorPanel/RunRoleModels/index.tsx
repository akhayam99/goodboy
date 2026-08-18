import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type {
  AgentRole,
  ProviderId,
  RoleModelPreferences,
  SessionId,
  WorkflowRun,
} from '@goodboy/types';
import { roleModelsForSession } from '../../../../../store/slices/overrides/roleModelsForSession';
import { useAppStore } from '../../../../../store/store';
import { RunRoleModelRow } from './RunRoleModelRow';

const RUN_ROLES = [
  'scout',
  'investigator',
  'planner',
  'implementer',
  'reviewer',
  'tester',
  'custom',
] satisfies ReadonlyArray<AgentRole>;

type Props = {
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly disabled: boolean;
};

const EMPTY_OVERRIDES: RoleModelPreferences = {};

export const RunRoleModels = ({ sessionId, run, disabled }: Props) => {
  const workspaceRoleModels = useAppStore((state) => roleModelsForSession({ state, sessionId }));
  const providers = useAppStore((state) => state.providers);
  const setWorkflowRoleModelOverrides = useAppStore((state) => state.setWorkflowRoleModelOverrides);
  const defaultProvider = useAppStore((state) => {
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    return (session?.providerOverride ??
      session?.providerPreference.defaultProvider ??
      'anthropic') as ProviderId;
  });
  const overrides = run.roleModelOverrides ?? EMPTY_OVERRIDES;
  const connectedProviders = providers
    .filter((provider) => provider.connection === 'connected')
    .map((provider) => provider.id)
    .filter((candidate) => PROVIDER_CAPABILITIES[candidate].models.length > 0);

  const apply = (next: RoleModelPreferences) =>
    void setWorkflowRoleModelOverrides(sessionId, run.id, next);

  return (
    <section
      aria-label="Models by role"
      data-testid="orchestrator-role-models"
      className="flex flex-col gap-1.5 rounded-md border border-border-soft bg-background/40 px-2 py-2"
    >
      <span className="text-2xs font-semibold text-foreground">Models by role</span>
      <p className="text-2xs leading-relaxed text-muted-foreground">
        The orchestrator picks a role for every step it decides. A role you set here runs on that
        model for the rest of this run.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {RUN_ROLES.map((role) => (
          <RunRoleModelRow
            key={role}
            role={role}
            workspaceRoleModels={workspaceRoleModels}
            overrides={overrides}
            defaultProvider={defaultProvider}
            connectedProviders={connectedProviders}
            disabled={disabled}
            onChange={apply}
          />
        ))}
      </div>
    </section>
  );
};
