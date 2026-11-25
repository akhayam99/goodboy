import { useMemo, useState } from 'react';
import type { AgentRole, ProviderId, WorkspaceId } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import type { StepDraft } from '../../../engine';
import { pinRoleSteps } from '../../../engine/pinRoleSteps';
import { rolePinOf } from '../../../engine/rolePinOf';
import { WorkflowModelRow } from './WorkflowModelRow';
import { WorkflowSection } from './WorkflowSection';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly steps: ReadonlyArray<StepDraft>;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly isCollapsed: boolean;
  readonly isDisabled: boolean;
  readonly onSteps: (next: (current: ReadonlyArray<StepDraft>) => ReadonlyArray<StepDraft>) => void;
};

const HELP = 'Each role follows Every run until you change it here.';

export const WorkflowModels = ({
  workspaceId,
  steps,
  connectedProviders,
  isCollapsed,
  isDisabled,
  onSteps,
}: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const roles = useMemo<ReadonlyArray<AgentRole>>(
    () => [...new Set(steps.map((step) => step.role))],
    [steps],
  );
  const hasPins = roles.some((role) => rolePinOf({ steps, role }).kind !== 'follows');
  const isFolded = isCollapsed && !isOpen && !hasPins;

  return (
    <WorkflowSection label="Models" help={HELP}>
      {isFolded ? (
        <div className="flex min-w-0 items-center justify-between gap-3">
          <span className="text-meta text-faint-foreground">Same as Every run</span>
          <Button variant="ghost" size="sm" disabled={isDisabled} onClick={() => setIsOpen(true)}>
            Change
          </Button>
        </div>
      ) : roles.length === 0 ? (
        <p className="text-meta text-faint-foreground">Add a step to set its models.</p>
      ) : (
        <div className="flex min-w-0 flex-col gap-1">
          {roles.map((role) => (
            <WorkflowModelRow
              key={role}
              workspaceId={workspaceId}
              role={role}
              pin={rolePinOf({ steps, role })}
              connectedProviders={connectedProviders}
              isDisabled={isDisabled}
              onPin={(route) => onSteps((current) => pinRoleSteps({ steps: current, role, route }))}
            />
          ))}
        </div>
      )}
    </WorkflowSection>
  );
};
