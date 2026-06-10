import { useEffect, useState } from 'react';
import { ChevronsUpDown, Settings } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore, useCurrentWorkspace, useHasUnreadElsewhere } from '../../../../store';
import { workspaceAccent } from '../../color';
import { WorkspaceSettingsDialog } from '../WorkspaceSettingsDialog';

export const WorkspaceHeader = () => {
  const currentWorkspace = useCurrentWorkspace();
  const hasUnreadElsewhere = useHasUnreadElsewhere(currentWorkspace?.id ?? null);
  const workspaces = useAppStore((s) => s.workspaces);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<string | undefined>(undefined);
  const [settingsWorkspaceId, setSettingsWorkspaceId] = useState<WorkspaceId | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ section?: string; workspaceId?: WorkspaceId }>).detail;
      const target = detail?.workspaceId ?? currentWorkspace?.id ?? null;
      if (!target) {
        return;
      }
      setSettingsWorkspaceId(target);
      setSettingsSection(detail?.section);
      setSettingsOpen(true);
    };
    window.addEventListener('goodboy:open-workspace-settings', handler);
    return () => window.removeEventListener('goodboy:open-workspace-settings', handler);
  }, [currentWorkspace]);

  if (!currentWorkspace) {
    return null;
  }
  const accent = workspaceAccent(currentWorkspace.id);
  const settingsWorkspace =
    workspaces.find((w) => w.id === settingsWorkspaceId) ?? currentWorkspace;

  return (
    <div className="shrink-0 px-3 py-3" data-tauri-drag-region="false">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-5 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher'))}
          data-tauri-drag-region="false"
          className="group flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-muted/50"
          title="Switch or open a workspace"
          aria-label="Switch or open a workspace"
        >
          <span className="truncate text-sm font-semibold text-foreground">
            {currentWorkspace.name}
          </span>
          {hasUnreadElsewhere ? (
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full bg-warning"
              title="activity in another workspace"
            />
          ) : null}
          <ChevronsUpDown
            size={13}
            aria-hidden
            className="shrink-0 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground"
          />
        </button>
        <button
          type="button"
          onClick={() => {
            setSettingsWorkspaceId(currentWorkspace.id);
            setSettingsSection(undefined);
            setSettingsOpen(true);
          }}
          data-tauri-drag-region="false"
          className="flex shrink-0 items-center p-1 text-muted-foreground/50 transition-colors hover:text-foreground"
          title={`workspace settings, ${currentWorkspace.name}`}
          aria-label={`open workspace settings for ${currentWorkspace.name}`}
        >
          <Settings size={13} aria-hidden />
        </button>
      </div>
      <WorkspaceSettingsDialog
        workspaceId={settingsWorkspace.id}
        workspaceName={settingsWorkspace.name}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialSection={settingsSection}
      />
    </div>
  );
};
