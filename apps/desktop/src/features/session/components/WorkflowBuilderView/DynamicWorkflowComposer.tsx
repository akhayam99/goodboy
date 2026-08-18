import { Divider, Input, Textarea } from '@goodboy/ui';
import type { ProviderId, RoleModelPreferences } from '@goodboy/types';
import type { Dispatch, SetStateAction } from 'react';
import { DynamicRoleRouting } from './DynamicRoleRouting';

type Props = {
  readonly name: string;
  readonly process: string;
  readonly workspaceRoleModels: RoleModelPreferences | null;
  readonly roleModelOverrides: RoleModelPreferences;
  readonly defaultProvider: ProviderId;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly disabled: boolean;
  readonly onName: (name: string) => void;
  readonly onProcess: (process: string) => void;
  readonly onRoleModelOverrides: Dispatch<SetStateAction<RoleModelPreferences>>;
};

export const DynamicWorkflowComposer = ({
  name,
  process,
  workspaceRoleModels,
  roleModelOverrides,
  defaultProvider,
  connectedProviders,
  disabled,
  onName,
  onProcess,
  onRoleModelOverrides,
}: Props) => (
  <div className="overflow-hidden rounded-lg border border-border-soft bg-subtle/40">
    <div className="flex flex-col gap-1 p-3">
      <label
        htmlFor="orchestrated-workflow-name"
        className="text-2xs font-medium text-muted-foreground"
      >
        Workflow name
      </label>
      <Input
        id="orchestrated-workflow-name"
        value={name}
        onChange={(event) => onName(event.target.value)}
        disabled={disabled}
        className="h-8 bg-background/70 text-sm font-medium"
      />
    </div>
    <Divider />
    <div className="flex flex-col gap-1 p-3">
      <label
        htmlFor="orchestrated-workflow-intent"
        className="text-2xs font-medium text-muted-foreground"
      >
        Intent and constraints
      </label>
      <Textarea
        id="orchestrated-workflow-intent"
        value={process}
        onChange={(event) => onProcess(event.target.value)}
        placeholder="describe the intent, constraints, and stopping conditions…"
        autoGrow
        minRows={3}
        maxRows={7}
        disabled={disabled}
        className="resize-none bg-background/70 text-sm"
      />
    </div>
    <Divider />
    <div className="p-3">
      <DynamicRoleRouting
        workspaceRoleModels={workspaceRoleModels}
        overrides={roleModelOverrides}
        defaultProvider={defaultProvider}
        connectedProviders={connectedProviders}
        disabled={disabled}
        onChange={onRoleModelOverrides}
      />
    </div>
  </div>
);
