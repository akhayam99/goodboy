import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button, Divider, EmptyState, Kbd, ScrollFade } from '@goodboy/ui';
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
import { WORKSPACE_DIGIT_IDS, shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { CurrentWorkspaceRow } from './CurrentWorkspaceRow';
import { OtherWorkspaceRow } from './OtherWorkspaceRow';
import { DisconnectedWorkspaceRow } from './DisconnectedWorkspaceRow';
import { useAddFolderHere } from './useAddFolderHere';
import { WorkspaceOpenConfirm } from './WorkspaceOpenConfirm';
import { isSubmitChord } from '../../../../shared/keyboard/isSubmitChord';
import { NAMES } from '../../../../shared/names';
import { openNewWorkspace } from '../../openNewWorkspace';

type Props = {
  readonly onClose: () => void;
};

type PendingConfirm = {
  readonly id: WorkspaceId;
  readonly title: string;
  readonly running: number;
};

type LeaveParams = {
  readonly action: () => void;
};

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
  const addFolderHere = useAddFolderHere({ workspace: currentWorkspace });

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

  const leaveFor =
    ({ action }: LeaveParams) =>
    () => {
      onClose();
      action();
    };

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
    if (isSubmitChord(e)) {
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
      <div className="flex items-center gap-2 px-3 py-3">
        <Search size={ICON_SIZE.control} aria-hidden className="text-faint-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find a workspace or folder"
          aria-label="Find a workspace or folder"
          className="flex-1 bg-transparent text-label focus-visible:outline-none"
        />
        <Kbd look="inline">{shortcutGlyphs('workspace.switcher')}</Kbd>
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
            onAddFolder={leaveFor({ action: () => void addFolderHere() })}
            onManageFolders={leaveFor({
              action: () => openSettings({ scope: 'workspace', section: 'projects' }),
            })}
            onOpenSettings={leaveFor({ action: () => openSettings({ scope: 'workspace' }) })}
          />
        ) : null}
        {filtered.length === 0 && query.trim() !== '' ? (
          <EmptyState
            size="section"
            icon={CONCEPT_ICONS.workspace}
            tone={CONCEPT_TONE.workspace}
            title="No other workspaces match"
          />
        ) : (
          filtered.map((w, i) => (
            <div key={w.id} className="flex flex-col gap-1">
              <OtherWorkspaceRow
                workspace={w}
                highlighted={i === activeIndex}
                digitShortcut={query.trim() === '' ? (WORKSPACE_DIGIT_IDS[i] ?? null) : null}
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
        {query.trim() === ''
          ? disconnectedWorkspaces.map((workspace) => (
              <DisconnectedWorkspaceRow
                key={workspace.id}
                workspace={workspace}
                onReconnect={() => void reconnectWorkspaceById(workspace.id)}
              />
            ))
          : null}
      </ScrollFade>
      <Divider />
      <div className="flex items-center gap-1 p-1">
        <Button size="sm" variant="ghost" onClick={leaveFor({ action: openNewWorkspace })}>
          <Plus size={ICON_SIZE.row} aria-hidden />
          {NAMES.newWorkspace}
        </Button>
      </div>
    </>
  );
};
