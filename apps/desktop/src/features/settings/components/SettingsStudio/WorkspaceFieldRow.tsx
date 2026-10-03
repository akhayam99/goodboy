import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { FieldRow, OverflowMenu, Tooltip } from '@goodboy/ui';
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
    <Tooltip content={`Changed from default. Default: ${state.defaultLabel}`}>
      <span
        tabIndex={0}
        role="img"
        aria-label={`Changed from default. Default: ${state.defaultLabel}`}
        data-changed-marker=""
        className="block size-1.5 shrink-0 rounded-full bg-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      />
    </Tooltip>
  ) : null;
  const menu = (
    <OverflowMenu
      label={`${state.label} options`}
      items={[
        {
          kind: 'item',
          key: 'reset',
          label: 'Reset',
          icon: RotateCcw,
          hint: state.isChanged ? `Default: ${state.defaultLabel}` : 'Already default',
          disabled: !state.isChanged,
          onClick: () => void state.reset(),
        },
      ]}
    />
  );
  return (
    <FieldRow label={state.label} help={help} marker={marker} menu={menu} layout={layout}>
      {children}
    </FieldRow>
  );
};
