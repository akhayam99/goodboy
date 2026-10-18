import { useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { OverflowMenu, PaneShell, type OverflowMenuItem } from '@goodboy/ui';
import { Copy, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../../../store';
import { pluralize } from '../../../../shared/utils/pluralize';
import { pageKeys } from '../../pageKeys';
import { usePageChangedCount } from '../../hooks/usePageChangedCount';
import { storageWorkspacePages } from '../../../storage/storageWorkspacePages';
import { folderMetaOf } from './folderMetaOf';
import { SETTINGS_PANE_ENTRY } from './settingsPaneEntry';
import { WorkspacePageBody } from './WorkspacePageBody';
import { WorkspaceSettingsFlow, type FlowMode } from './WorkspaceSettingsFlow';
import { workspacePageEntry, workspacePageOf, type WorkspacePage } from './workspacePages';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly section?: string;
  readonly initialFlow?: FlowMode;
  readonly requestClose: () => void;
};

export const WorkspaceScopePanel = ({ workspaceId, section, initialFlow, requestClose }: Props) => {
  const hasOtherWorkspace = useAppStore((s) => s.workspaces.some((w) => w.id !== workspaceId));
  const page = workspacePageOf({ section });
  const entry = workspacePageEntry({ page });
  const ownsSettings = pageKeys({ page }).length > 0;
  const changedCount = usePageChangedCount({ workspaceId, page });
  const folderMeta = useAppStore((s) => folderMetaOf({ projects: s.projects, workspaceId }));
  const [flow, setFlow] = useState<{
    readonly page: WorkspacePage;
    readonly scope: WorkspacePage | 'all';
    readonly mode: FlowMode;
  } | null>(initialFlow === undefined ? null : { page, scope: 'all', mode: initialFlow });
  const openFlow = flow !== null && flow.page === page ? flow : null;

  const pageItems: ReadonlyArray<OverflowMenuItem> = ownsSettings
    ? [
        {
          kind: 'item',
          key: 'restore',
          label: 'Restore defaults',
          icon: RotateCcw,
          hint: changedCount === 0 ? 'Already default' : `${pluralize(changedCount, 'change')}`,
          disabled: changedCount === 0,
          onClick: () => setFlow({ page, scope: page, mode: 'restore' }),
        },
        {
          kind: 'item',
          key: 'copy',
          label: 'Copy from…',
          icon: Copy,
          hint: hasOtherWorkspace ? undefined : 'No other workspace',
          disabled: !hasOtherWorkspace,
          onClick: () => setFlow({ page, scope: page, mode: 'copy' }),
        },
        { kind: 'separator', key: 'all-pages' },
      ]
    : [];

  const menu = (
    <OverflowMenu
      label={`${entry.label} actions`}
      items={[
        ...pageItems,
        {
          kind: 'item',
          key: 'restore-all',
          label: 'Restore all workspace defaults',
          icon: RotateCcw,
          onClick: () => setFlow({ page, scope: 'all', mode: 'restore' }),
        },
        {
          kind: 'item',
          key: 'copy-all',
          label: 'Copy all pages from…',
          icon: Copy,
          hint: hasOtherWorkspace ? undefined : 'No other workspace',
          disabled: !hasOtherWorkspace,
          onClick: () => setFlow({ page, scope: 'all', mode: 'copy' }),
        },
      ]}
    />
  );

  return (
    <PaneShell
      page="settings"
      key={page}
      animationClassName={SETTINGS_PANE_ENTRY}
      title={entry.label}
      meta={page === 'projects' ? folderMeta : undefined}
      actions={
        page === 'branches' ? (
          <>
            {storageWorkspacePages({ workspaceId }).branches.actions}
            {menu}
          </>
        ) : (
          menu
        )
      }
      subheader={
        openFlow === null ? undefined : (
          <WorkspaceSettingsFlow
            key={`${openFlow.scope}:${openFlow.mode}`}
            workspaceId={workspaceId}
            scope={openFlow.scope}
            mode={openFlow.mode}
            onClose={() => setFlow(null)}
          />
        )
      }
    >
      <WorkspacePageBody
        workspaceId={workspaceId}
        page={page}
        section={section}
        requestClose={requestClose}
      />
    </PaneShell>
  );
};
