import { useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { OverflowMenu, PaneShell } from '@goodboy/ui';
import { Copy, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../../../store';
import { pluralize } from '../../../../shared/utils/pluralize';
import type { SettingsScopeChange } from '../../settingsFocus';
import { pageKeys } from '../../pageKeys';
import { usePageChangedCount } from '../../hooks/usePageChangedCount';
import { SETTINGS_PANE_ENTRY } from './settingsPaneEntry';
import { WorkspacePageBody } from './WorkspacePageBody';
import { WorkspaceSettingsFlow, type FlowMode } from './WorkspaceSettingsFlow';
import { workspacePageEntry, workspacePageOf, type WorkspacePage } from './workspacePages';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly section?: string;
  readonly onSelect: (change: SettingsScopeChange) => void;
  readonly requestClose: () => void;
};

export const WorkspaceScopePanel = ({ workspaceId, section, onSelect, requestClose }: Props) => {
  const workspaceName = useAppStore(
    (s) => s.workspaces.find((w) => w.id === workspaceId)?.name ?? null,
  );
  const hasOtherWorkspace = useAppStore((s) => s.workspaces.some((w) => w.id !== workspaceId));
  const page = workspacePageOf({ section });
  const entry = workspacePageEntry({ page });
  const ownsSettings = pageKeys({ page }).length > 0;
  const changedCount = usePageChangedCount({ workspaceId, page });
  const [flow, setFlow] = useState<{
    readonly page: WorkspacePage;
    readonly mode: FlowMode;
  } | null>(null);
  const openFlow = flow !== null && flow.page === page ? flow : null;

  const menu = ownsSettings ? (
    <OverflowMenu
      label={`${entry.label} actions`}
      items={[
        {
          kind: 'item',
          key: 'restore',
          label: 'Restore defaults',
          icon: RotateCcw,
          hint: changedCount === 0 ? 'Already default' : `${pluralize(changedCount, 'change')}`,
          disabled: changedCount === 0,
          onClick: () => setFlow({ page, mode: 'restore' }),
        },
        {
          kind: 'item',
          key: 'copy',
          label: 'Copy from…',
          icon: Copy,
          hint: hasOtherWorkspace ? undefined : 'No other workspace',
          disabled: !hasOtherWorkspace,
          onClick: () => setFlow({ page, mode: 'copy' }),
        },
      ]}
    />
  ) : undefined;

  return (
    <PaneShell
      key={page}
      animationClassName={SETTINGS_PANE_ENTRY}
      title={entry.label}
      meta={workspaceName ?? undefined}
      actions={menu}
      subheader={
        <div className="flex flex-col gap-3">
          <p className="text-label text-muted-foreground">{entry.hint}</p>
          {openFlow === null ? null : (
            <WorkspaceSettingsFlow
              key={`${openFlow.page}:${openFlow.mode}`}
              workspaceId={workspaceId}
              scope={openFlow.page}
              mode={openFlow.mode}
              onClose={() => setFlow(null)}
            />
          )}
        </div>
      }
    >
      <WorkspacePageBody
        workspaceId={workspaceId}
        page={page}
        section={section}
        onSelect={onSelect}
        requestClose={requestClose}
      />
    </PaneShell>
  );
};
