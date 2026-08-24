import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Unplug } from 'lucide-react';
import {
  Button,
  Checkbox,
  EmptyState,
  Eyebrow,
  InlineConfirm,
  ScrollFade,
  Tooltip,
} from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { useAppStore, useWorkspaces } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { DogMascot } from '../../../../shared/components/DogMascot';
import { SETTING_REOPEN_LAST } from '../../../settings/settings';
import { UpdateIndicator } from '../../../updater/components/UpdateIndicator';
import { WorkspaceRow } from '../WorkspaceRow';
import { filterWorkspaces, sortWorkspacesByRecent } from '../../recent';

export const WorkspaceLauncher = () => {
  const workspaces = useWorkspaces();
  const projects = useAppStore((s) => s.projects);
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const deleteWorkspace = useAppStore((s) => s.deleteWorkspace);
  const reopenLast = useAppStore((s) => s.settings[SETTING_REOPEN_LAST] === '1');
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [disconnectTarget, setDisconnectTarget] = useState<Workspace | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(
    () => filterWorkspaces({ workspaces: sortWorkspacesByRecent(workspaces), projects, query }),
    [workspaces, projects, query],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const select = (workspace: Workspace) => {
    void openWorkspace(workspace.id, workspace.name);
  };

  const addWorkspace = () => window.dispatchEvent(new CustomEvent('goodboy:add-workspace'));

  const confirmDisconnect = async () => {
    if (!disconnectTarget) {
      return;
    }
    await deleteWorkspace(disconnectTarget.id);
    setDisconnectTarget(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = filtered[activeIndex];
      if (picked) {
        select(picked);
      }
    }
  };

  return (
    <ScrollFade
      className="h-full w-full"
      viewportClassName="relative flex items-center justify-center bg-background px-6 py-10"
    >
      <div data-tauri-drag-region="false" className="absolute right-4 top-3">
        <UpdateIndicator variant="bar" />
      </div>
      <div className="flex w-full max-w-xl flex-col gap-6 motion-safe:animate-fade-in">
        <div className="flex flex-col items-center gap-3 pb-2 text-center">
          <DogMascot size={56} className="text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Open a workspace</h1>
        </div>

        <div className="relative">
          <Search
            size={15}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search workspaces or paths…"
            className="w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Eyebrow label="Recent" className="px-1" />
          <ul className="flex flex-col gap-0.5">
            {filtered.length === 0 ? (
              <li>
                <EmptyState
                  icon={CONCEPT_ICONS.workspace}
                  tone={CONCEPT_TONE.workspace}
                  title="No workspaces found"
                  size="inline"
                  className="px-3 py-8"
                />
              </li>
            ) : (
              filtered.map((w, i) =>
                disconnectTarget?.id === w.id ? (
                  <li key={w.id}>
                    <InlineConfirm
                      role="danger"
                      icon={<Unplug size={12} aria-hidden />}
                      title={`Disconnect ${w.name}?`}
                      description="Hides it from this list. Nothing on disk is deleted, re-add the same path to bring it back with all its sessions."
                      confirmLabel="Disconnect"
                      onConfirm={confirmDisconnect}
                      onCancel={() => setDisconnectTarget(null)}
                    />
                  </li>
                ) : (
                  <li key={w.id} className="group/launcher relative">
                    <WorkspaceRow
                      workspace={w}
                      density="card"
                      highlighted={i === activeIndex}
                      onOpen={() => select(w)}
                    />
                    <Tooltip content={`Disconnect ${w.name}`}>
                      <button
                        type="button"
                        data-tauri-drag-region="false"
                        aria-label={`Disconnect ${w.name}`}
                        onClick={() => setDisconnectTarget(w)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-border-soft bg-background p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover/launcher:opacity-100"
                      >
                        <Unplug size={13} aria-hidden />
                      </button>
                    </Tooltip>
                  </li>
                ),
              )
            )}
          </ul>
        </div>

        <Button variant="secondary" onClick={addWorkspace} className="w-fit">
          <Plus size={14} aria-hidden />
          New workspace
        </Button>

        <Checkbox
          label="Reopen last workspace on launch"
          checked={reopenLast}
          onChange={(next) => void saveSetting(SETTING_REOPEN_LAST, next ? '1' : '0')}
          className="text-muted-foreground"
        />
      </div>
    </ScrollFade>
  );
};
