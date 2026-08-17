import type { Dispatch, SetStateAction } from 'react';
import { recommendedModelForRole, resolveRoleRouting } from '@goodboy/core';
import type {
  AgentRole,
  ProviderId,
  RoleModelPreference,
  RoleModelPreferences,
} from '@goodboy/types';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { ROLE_LABEL } from '../../agent-kind';

const DYNAMIC_ROLES = [
  'scout',
  'investigator',
  'planner',
  'implementer',
  'reviewer',
  'tester',
  'custom',
] satisfies ReadonlyArray<AgentRole>;

type Props = {
  readonly workspaceRoleModels: RoleModelPreferences | null;
  readonly overrides: RoleModelPreferences;
  readonly defaultProvider: ProviderId;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly disabled: boolean;
  readonly onChange: Dispatch<SetStateAction<RoleModelPreferences>>;
};

type DefaultRoutingParams = {
  readonly role: AgentRole;
  readonly workspaceRoleModels: RoleModelPreferences | null;
  readonly defaultProvider: ProviderId;
};

const defaultRouting = ({
  role,
  workspaceRoleModels,
  defaultProvider,
}: DefaultRoutingParams): RoleModelPreference => {
  const configured = resolveRoleRouting({ role, prefs: workspaceRoleModels });
  if (configured.isOverride) {
    return {
      providerId: configured.provider,
      model: configured.model,
      effort: configured.effort,
      ...(configured.fallback != null && {
        fallback: {
          providerId: configured.fallback.provider,
          model: configured.fallback.model,
          effort: configured.fallback.effort,
        },
      }),
    };
  }
  return {
    providerId: defaultProvider,
    model: recommendedModelForRole({
      role,
      provider: defaultProvider,
      prefs: workspaceRoleModels,
    }),
    effort: configured.effort,
  };
};

export const DynamicRoleRouting = ({
  workspaceRoleModels,
  overrides,
  defaultProvider,
  connectedProviders,
  disabled,
  onChange,
}: Props) => (
  <section aria-label="Models by role" className="flex flex-col gap-2">
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-foreground">Models by role</span>
      <span className="text-2xs leading-relaxed text-muted-foreground">
        The orchestrator chooses a role at runtime. Each role inherits provider defaults unless you
        override it for this run.
      </span>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      {DYNAMIC_ROLES.map((role) => {
        const inherited = defaultRouting({ role, workspaceRoleModels, defaultProvider });
        const override = overrides[role];
        const selected = override ?? inherited;
        const label = ROLE_LABEL[role];
        return (
          <div
            key={role}
            role="group"
            aria-label={`${label} model`}
            className="flex min-w-0 items-center justify-between gap-2"
          >
            <span className="shrink-0 text-2xs font-medium text-muted-foreground">{label}</span>
            <div className="min-w-0 max-w-64 flex-1">
              <RoutingPicker
                ariaLabel={`${label} routing`}
                connectedProviders={connectedProviders}
                provider={override?.providerId ?? ''}
                model={override?.model ?? ''}
                effort={{
                  editable: true,
                  value: selected.effort,
                  onChange: (effort) =>
                    onChange((current) => ({
                      ...current,
                      [role]: {
                        ...(current[role] ?? inherited),
                        effort,
                      },
                    })),
                }}
                recommendation={{
                  provider: inherited.providerId,
                  model: inherited.model,
                }}
                disabled={disabled}
                overridden={override != null}
                onReset={() =>
                  onChange((current) => {
                    const next = { ...current };
                    delete next[role];
                    return next;
                  })
                }
                onProvider={(nextProvider) => {
                  if (nextProvider === '') {
                    onChange((current) => {
                      const next = { ...current };
                      delete next[role];
                      return next;
                    });
                    return;
                  }
                  onChange((current) => ({
                    ...current,
                    [role]: {
                      providerId: nextProvider,
                      model: recommendedModelForRole({
                        role,
                        provider: nextProvider,
                        prefs: null,
                      }),
                      effort: (current[role] ?? inherited).effort,
                    },
                  }));
                }}
                onModel={(model) =>
                  onChange((current) => ({
                    ...current,
                    [role]: {
                      ...(current[role] ?? inherited),
                      model,
                    },
                  }))
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  </section>
);
