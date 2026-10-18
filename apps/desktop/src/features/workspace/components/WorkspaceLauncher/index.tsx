import { useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, FolderPlus, Plus, Search, Unplug } from 'lucide-react';
import {
  Button,
  Checkbox,
  Eyebrow,
  IconButton,
  ConfirmPopover,
  ScrollFade,
  EmptyState,
} from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { useAppStore, useWorkspaces } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { SETTING_REOPEN_LAST } from '../../../settings/settings';
import { UpdatePill } from '../../../updater/components/UpdatePill';
import { WorkspaceListRow } from '../WorkspaceListRow';
import { filterWorkspaces, sortWorkspacesByRecent } from '../../recent';
import { NewWorkspaceForm } from '../../../../shared/components/NewWorkspaceForm';
import { ConceptTile } from '../../../../shared/components/ConceptTile';

export const WorkspaceLauncher = () => {
  const workspaces = useWorkspaces();
  const projects = useAppStore((s) => s.projects);
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const disconnectWorkspace = useAppStore((s) => s.disconnectWorkspace);
  const reopenLast = useAppStore((s) => s.settings[SETTING_REOPEN_LAST] === '1');
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [isStarting, setIsStarting] = useState(false);

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
    void openWorkspace({ id: workspace.id, title: workspace.name, onRunning: 'new-window' });
  };

  const addWorkspace = () => window.dispatchEvent(new CustomEvent('goodboy:add-workspace'));

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
      <div data-tauri-drag-region aria-hidden className="absolute inset-x-0 top-0 h-9" />
      <div
        data-tauri-drag-region="false"
        className="absolute right-4 top-3 flex items-center gap-2"
      >
        <UpdatePill />
        <IconButton
          icon={CONCEPT_ICONS.settings}
          label="Open settings"
          shortcut="settings.open"
          variant="ghost"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('goodboy:open-settings', { detail: { scope: 'home' } }),
            )
          }
        />
      </div>
      <div className="flex w-full max-w-xl flex-col gap-6 motion-safe:animate-fade-in">
        <div className="flex flex-col items-center gap-3 pb-2 text-center">
          <ConceptTile icon={CONCEPT_ICONS.workspace} tone={CONCEPT_TONE.workspace} />
          <h1 className="text-title text-foreground">Open a workspace</h1>
        </div>

        {isStarting ? (
          <NewWorkspaceForm
            mode="new"
            start="scratch"
            onCreated={() => setIsStarting(false)}
            onCancel={() => setIsStarting(false)}
            backLabel="Cancel"
          />
        ) : null}

        <div className="relative">
          <Search
            size={ICON_SIZE.control}
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint-foreground"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search workspaces or paths…"
            className="w-full rounded-lg border border-border bg-background py-3 pl-9 pr-4 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Eyebrow label="Recent" className="px-1" />
          <ul className="flex flex-col gap-0.5">
            {filtered.length === 0 ? (
              <li>
                <EmptyState
                  size="section"
                  icon={CONCEPT_ICONS.workspace}
                  tone={CONCEPT_TONE.workspace}
                  title="No workspaces found"
                />
              </li>
            ) : (
              filtered.map((w, i) => (
                <li key={w.id} className="group/launcher relative">
                  <WorkspaceListRow
                    workspace={w}
                    highlighted={i === activeIndex}
                    onOpen={() => select(w)}
                  />
                  <ConfirmPopover
                    role="danger"
                    icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
                    title={`Disconnect ${w.name}?`}
                    description="Hides this workspace. Its folders and sessions stay; open its path to reconnect."
                    confirmLabel="Disconnect workspace"
                    onConfirm={() => disconnectWorkspace(w.id)}
                    anchorClassName="absolute right-2 top-1/2 -translate-y-1/2 flex"
                    returnFocusTo={{ rowSelector: 'li' }}
                    trigger={({ arm, isArmed }) => (
                      <IconButton
                        icon={Unplug}
                        label={`Disconnect ${w.name}`}
                        tooltip={`Disconnect ${w.name}`}
                        variant="ghost"
                        onClick={arm}
                        className={isArmed ? 'text-danger' : 'text-faint-foreground'}
                      />
                    )}
                  />
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="md"
            variant="secondary"
            disabled={isStarting}
            onClick={() => setIsStarting(true)}
            className="w-fit"
          >
            <FolderPlus size={ICON_SIZE.control} aria-hidden />
            Start a new project
          </Button>
          <Button size="md" variant="secondary" onClick={addWorkspace} className="w-fit">
            <FolderOpen size={ICON_SIZE.control} aria-hidden />
            Open a folder
          </Button>
        </div>

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
