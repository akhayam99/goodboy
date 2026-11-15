import type { ReactNode } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import type { WorkspaceSettingField } from '../../pageKeys';
import { useFoldersWithOwn } from '../../hooks/useFoldersWithOwn';
import { useWorkspaceField } from '../../hooks/useWorkspaceField';
import { settingRowKeyOfField } from '../../settingRowKeyOfField';
import { SettingRow } from './SettingRow';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly field: WorkspaceSettingField;
  readonly help?: ReactNode;
  readonly layout?: 'horizontal' | 'stacked';
  readonly children: ReactNode;
};

export const WorkspaceFieldRow = ({ workspaceId, field, help, layout, children }: Props) => {
  const state = useWorkspaceField({ workspaceId, field });
  const foldersNote = useFoldersWithOwn({ workspaceId, field });
  return (
    <SettingRow
      label={state.label}
      rowKey={settingRowKeyOfField({ field })}
      help={help}
      layout={layout}
      chip={foldersNote}
      isChanged={state.isChanged}
      onReset={() => void state.reset()}
      save={state.save}
    >
      {children}
    </SettingRow>
  );
};
