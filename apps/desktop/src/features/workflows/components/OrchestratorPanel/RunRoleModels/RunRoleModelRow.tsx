import { recommendedModelForRole, resolveRoleRouting } from '@goodboy/core';
import type {
  AgentRole,
  ProviderId,
  RoleModelPreference,
  RoleModelPreferences,
} from '@goodboy/types';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { ROLE_LABEL } from '../../../../session/agent-kind';

type Props = {
  readonly role: AgentRole;
  readonly workspaceRoleModels: RoleModelPreferences | null;
  readonly overrides: RoleModelPreferences;
  readonly defaultProvider: ProviderId;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly disabled: boolean;
  readonly onChange: (overrides: RoleModelPreferences) => void;
};

type InheritedRoutingParams = {
  readonly role: AgentRole;
  readonly workspaceRoleModels: RoleModelPreferences | null;
  readonly defaultProvider: ProviderId;
};

const inheritedRouting = ({
  role,
  workspaceRoleModels,
  defaultProvider,
}: InheritedRoutingParams): RoleModelPreference => {
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

type WithoutRoleParams = {
  readonly overrides: RoleModelPreferences;
  readonly role: AgentRole;
};

const withoutRole = ({ overrides, role }: WithoutRoleParams): RoleModelPreferences => {
  const next = { ...overrides };
  delete next[role];
  return next;
};

export const RunRoleModelRow = ({
  role,
  workspaceRoleModels,
  overrides,
  defaultProvider,
  connectedProviders,
  disabled,
  onChange,
}: Props) => {
  const inherited = inheritedRouting({ role, workspaceRoleModels, defaultProvider });
  const override = overrides[role];
  const selected = override ?? inherited;
  const label = ROLE_LABEL[role];

  return (
    <div
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
              onChange({ ...overrides, [role]: { ...(override ?? inherited), effort } }),
          }}
          recommendation={{ provider: inherited.providerId, model: inherited.model }}
          disabled={disabled}
          overridden={override != null}
          onReset={() => onChange(withoutRole({ overrides, role }))}
          onProvider={(nextProvider) => {
            if (nextProvider === '') {
              onChange(withoutRole({ overrides, role }));
              return;
            }
            onChange({
              ...overrides,
              [role]: {
                providerId: nextProvider,
                model: recommendedModelForRole({ role, provider: nextProvider, prefs: null }),
                effort: (override ?? inherited).effort,
              },
            });
          }}
          onModel={(model) =>
            onChange({ ...overrides, [role]: { ...(override ?? inherited), model } })
          }
        />
      </div>
    </div>
  );
};
