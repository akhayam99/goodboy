import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { FieldRow, IconButton } from '@goodboy/ui';
import type { WorkspaceSettingField } from '../../pageKeys';
import { useWorkspaceField } from '../../hooks/useWorkspaceField';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly field: WorkspaceSettingField;
  readonly help?: ReactNode;
  readonly layout?: 'horizontal' | 'stacked';
  readonly children: ReactNode;
};

export const WorkspaceFieldRow = ({ workspaceId, field, help, layout, children }: Props) => {
  const state = useWorkspaceField({ workspaceId, field });
  const marker = state.isChanged ? (
    <IconButton
      icon={RotateCcw}
      label={`Reset ${state.label} to default`}
      tooltip="Reset to default"
      size="xs"
      data-changed-marker=""
      onClick={() => void state.reset()}
    />
  ) : null;
  return (
    <FieldRow label={state.label} help={help} marker={marker} layout={layout}>
      {children}
    </FieldRow>
  );
};
