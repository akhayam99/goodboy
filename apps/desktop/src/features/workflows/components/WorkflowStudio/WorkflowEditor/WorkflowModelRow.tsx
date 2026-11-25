import { useState } from 'react';
import type { AgentRole, ProviderId, WorkspaceId } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { actionButtonLookOf } from '../../../../actions/actionButtonLookOf';
import { RoutingPicker } from '../../../../../shared/components/RoutingPicker';
import { roleSetEntries } from '../../../../providers/roleSetEntries';
import { ROLE_LABEL } from '../../../../session/agent-kind';
import type { RolePin } from '../../../engine/rolePinOf';

type Route = {
  readonly provider: ProviderId;
  readonly model: string;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly role: AgentRole;
  readonly pin: RolePin;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly isDisabled: boolean;
  readonly onPin: (route: Route | null) => void;
};

export const WorkflowModelRow = ({
  workspaceId,
  role,
  pin,
  connectedProviders,
  isDisabled,
  onPin,
}: Props) => {
  const [isPicking, setIsPicking] = useState(false);
  const preference = useAppStore(
    (state) => state.workspaceOverrides?.[workspaceId]?.roleModels?.[role] ?? null,
  );
  const label = ROLE_LABEL[role];
  const first = roleSetEntries({ preference }).find((entry) => !entry.isGone);
  const everyRun = `Same as Every run: ${first === undefined ? 'Auto' : first.label}`;
  const route: { readonly provider: ProviderId | ''; readonly model: string } =
    pin.kind === 'pinned'
      ? { provider: pin.provider, model: pin.model }
      : first === undefined
        ? { provider: '', model: '' }
        : { provider: first.choice.providerId, model: first.choice.model };

  return (
    <div data-workflow-model={role} className="flex min-w-0 flex-col gap-2">
      <div className="flex min-h-9 min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="min-w-20 text-control text-foreground">{label}</span>
        <div className="flex min-w-0 items-center gap-2">
          {pin.kind === 'follows' ? (
            <span className="min-w-0 truncate text-meta text-faint-foreground">{everyRun}</span>
          ) : null}
          {pin.kind === 'mixed' ? (
            <span className="min-w-0 truncate text-meta text-muted-foreground">Set per step</span>
          ) : null}
          {pin.kind === 'pinned' ? (
            <RoutingPicker
              variant="pill"
              ariaLabel={`${label} model`}
              connectedProviders={connectedProviders}
              provider={pin.provider}
              model={pin.model}
              effort={{ editable: false }}
              isEffortHidden
              disabled={isDisabled}
              overridden
              onChange={(next) => {
                if (next.provider !== '') {
                  onPin({ provider: next.provider, model: next.model });
                }
              }}
            />
          ) : null}
          {pin.kind === 'pinned' || pin.kind === 'mixed' ? (
            <Button
              {...actionButtonLookOf({ verb: 'reset', variant: 'ghost' })}
              size="sm"
              disabled={isDisabled}
              aria-label={`Reset ${label} to Same as Every run`}
              onClick={() => onPin(null)}
            >
              Reset
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={isDisabled}
              aria-expanded={isPicking}
              aria-label={`Change ${label} model`}
              onClick={() => setIsPicking((isOpen) => !isOpen)}
            >
              {isPicking ? 'Done' : 'Change'}
            </Button>
          )}
        </div>
      </div>
      {isPicking && pin.kind === 'follows' ? (
        <RoutingPicker
          presentation="inline"
          ariaLabel={`${label} model`}
          connectedProviders={connectedProviders}
          provider={route.provider}
          model={route.model}
          effort={{ editable: false }}
          isEffortHidden
          disabled={isDisabled}
          onChange={(next) => {
            if (next.provider !== '') {
              onPin({ provider: next.provider, model: next.model });
              setIsPicking(false);
            }
          }}
        />
      ) : null}
    </div>
  );
};
