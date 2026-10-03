import { useEffect, useMemo, useRef, useState } from 'react';
import { FolderGit2, FolderOpen, FolderPlus, Search } from 'lucide-react';
import { Divider, FilledEmptyState, KbdPill, ScrollFade } from '@goodboy/ui';
import type { Workspace, WorkspaceId } from '@goodboy/types';
import {
  useAppStore,
  useCurrentWorkspace,
  useDisconnectedWorkspaces,
  useWorkspaces,
} from '../../../../store';
import { filterWorkspaces, sortWorkspacesByRecent } from '../../recent';
import { openSettings } from '../../../settings/openSettings';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { CurrentWorkspaceRow } from './CurrentWorkspaceRow';
import { OtherWorkspaceRow } from './OtherWorkspaceRow';
import { DisconnectedWorkspaces } from './DisconnectedWorkspaces';
import { WorkspaceOpenConfirm } from './WorkspaceOpenConfirm';

type Props = {
  readonly onClose: () => void;
};

type PendingConfirm = {
  readonly id: WorkspaceId;
  readonly title: string;
  readonly running: number;
};

const actionClass =
  'flex w-full items-center gap-2 px-3 py-2 text-label text-muted-foreground transition-colors hover:bg-hover hover:text-foreground';

export const WorkspaceSwitcher = ({ onClose }: Props) => {
  const workspaces = useWorkspaces();
  const disconnectedWorkspaces = useDisconnectedWorkspaces();
  const currentWorkspace = useCurrentWorkspace();
  const projects = useAppStore((s) => s.projects);
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const switchWorkspaceHere = useAppStore((s) => s.switchWorkspaceHere);
  const reconnectWorkspaceById = useAppStore((s) => s.reconnectWorkspaceById);
  const loadDisconnectedWorkspaces = useAppStore((s) => s.loadDisconnectedWorkspaces);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    void loadDisconnectedWorkspaces();
  }, [loadDisconnectedWorkspaces]);

  const otherWorkspaces = useMemo(
    () => workspaces.filter((w) => w.id !== currentWorkspace?.id),
    [workspaces, currentWorkspace],
  );

  const filtered = useMemo(
    () =>
      filterWorkspaces({ workspaces: sortWorkspacesByRecent(otherWorkspaces), projects, query }),
    [otherWorkspaces, projects, query],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const open = async (workspace: Workspace) => {
    const result = await openWorkspace({ id: workspace.id, title: workspace.name });
    if (result.kind === 'needs-confirm') {
      setPendingConfirm({ id: workspace.id, title: workspace.name, running: result.running });
      return;
    }
    onClose();
  };

  const openNewWindow = async (workspace: Workspace) => {
    await openWorkspace({ id: workspace.id, title: workspace.name, target: 'new-window' });
    onClose();
  };

  const cancelConfirm = () => setPendingConfirm(null);

  const confirmOpenNewWindow = async () => {
    if (pendingConfirm === null) {
      return;
    }
    await openWorkspace({
      id: pendingConfirm.id,
      title: pendingConfirm.title,
      target: 'new-window',
    });
    onClose();
  };

  const confirmStopAndOpenHere = async () => {
    if (pendingConfirm === null) {
      return;
    }
    await switchWorkspaceHere({ id: pendingConfirm.id, title: pendingConfirm.title });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && pendingConfirm !== null) {
      e.preventDefault();
      cancelConfirm();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      const picked = filtered[activeIndex];
      if (picked !== undefined) {
        void openNewWindow(picked);
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const picked = filtered[activeIndex];
      if (picked !== undefined) {
        void open(picked);
      }
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Search size={ICON_SIZE.control} aria-hidden className="text-faint-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find a workspace or project"
          aria-label="Find a workspace or project"
          className="flex-1 bg-transparent text-label focus-visible:outline-none"
        />
        <KbdPill>{shortcutGlyphs('workspace.switcher')}</KbdPill>
      </div>
      <Divider />
      <ScrollFade
        className="max-h-96"
        viewportClassName="flex flex-col gap-1 p-1"
        fadeFrom="elevated"
      >
        {currentWorkspace !== null ? (
          <CurrentWorkspaceRow
            workspace={currentWorkspace}
            onOpenSettings={() => {
              openSettings({ scope: 'workspace' });
              onClose();
            }}
          />
        ) : null}
        {filtered.length === 0 ? (
          <FilledEmptyState
            icon={CONCEPT_ICONS.workspace}
            tone={CONCEPT_TONE.workspace}
            title="No workspaces"
          />
        ) : (
          filtered.map((w, i) => (
            <div key={w.id}>
              <OtherWorkspaceRow
                workspace={w}
                highlighted={i === activeIndex}
                onOpen={() => void open(w)}
                onOpenNewWindow={() => void openNewWindow(w)}
              />
              {pendingConfirm?.id === w.id ? (
                <WorkspaceOpenConfirm
                  targetName={w.name}
                  currentName={currentWorkspace?.name ?? 'this workspace'}
                  running={pendingConfirm.running}
                  onOpenNewWindow={() => void confirmOpenNewWindow()}
                  onStopAndOpenHere={() => void confirmStopAndOpenHere()}
                  onCancel={cancelConfirm}
                />
              ) : null}
            </div>
          ))
        )}
        <DisconnectedWorkspaces
          workspaces={disconnectedWorkspaces}
          onReconnect={(id) => void reconnectWorkspaceById(id)}
        />
      </ScrollFade>
      <Divider />
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(new CustomEvent('goodboy:start-new-project'));
          onClose();
        }}
        className={actionClass}
      >
        <FolderPlus size={ICON_SIZE.row} aria-hidden />
        Start a new project
      </button>
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(new CustomEvent('goodboy:add-workspace'));
          onClose();
        }}
        className={actionClass}
      >
        <FolderOpen size={ICON_SIZE.row} aria-hidden />
        Open a folder
      </button>
      {currentWorkspace !== null ? (
        <button
          type="button"
          onClick={() => {
            openSettings({ scope: 'workspace', section: 'projects' });
            onClose();
          }}
          className={actionClass}
        >
          <FolderGit2 size={ICON_SIZE.row} aria-hidden />
          Manage projects
        </button>
      ) : null}
    </>
  );
};
