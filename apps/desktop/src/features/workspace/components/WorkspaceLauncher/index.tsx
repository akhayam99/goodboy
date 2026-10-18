import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Button,
  EmptyLine,
  Eyebrow,
  IconButton,
  KeyHint,
  ScrollFade,
  SearchField,
  Switch,
  cn,
  useEscapeLayer,
} from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { useAppStore, useWorkspaces } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { BrandTile } from '../../../../shared/components/BrandTile';
import { NewWorkspaceForm } from '../../../../shared/components/NewWorkspaceForm';
import { APP_VERSION } from '../../../../shared/lib/appVersion';
import { NAMES } from '../../../../shared/names';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { SETTING_REOPEN_LAST } from '../../../settings/settings';
import { UpdatePill } from '../../../updater/components/UpdatePill';
import { useSetupResume } from '../../../onboarding/useSetupResume';
import { filterWorkspaces, sortWorkspacesByRecent } from '../../recent';
import { useFolderFacesOnFocus } from '../../hooks/useFolderFacesOnFocus';
import { openNewWorkspace } from '../../openNewWorkspace';
import { useIsMainWindow } from '../../useIsMainWindow';
import { LauncherEmpty } from './LauncherEmpty';
import { WorkspaceRow } from './WorkspaceRow';
import { useHomeFolder } from './useHomeFolder';

type Props = {
  readonly isCreating: boolean;
  readonly onCloseCreate: () => void;
};

const SEARCH_FROM = 5;

const LOCKUP_TILE_PX = 40;

const openSettingsHome = () =>
  window.dispatchEvent(new CustomEvent('goodboy:open-settings', { detail: { scope: 'home' } }));

export const WorkspaceLauncher = ({ isCreating, onCloseCreate }: Props) => {
  const workspaces = useWorkspaces();
  const projects = useAppStore((s) => s.projects);
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const disconnectWorkspace = useAppStore((s) => s.disconnectWorkspace);
  const isReopenLast = useAppStore((s) => s.settings[SETTING_REOPEN_LAST] === '1');
  const home = useHomeFolder();
  const isInMainWindow = useIsMainWindow();
  const setup = useSetupResume({ isMainWindow: isInMainWindow });
  useFolderFacesOnFocus();
  const [query, setQuery] = useState('');
  const hasSearch = workspaces.length >= SEARCH_FROM;
  const view = isCreating ? 'new' : workspaces.length === 0 ? 'empty' : 'list';
  const [firstView] = useState(view);
  const [hasSwapped, setHasSwapped] = useState(false);
  if (!hasSwapped && view !== firstView) {
    setHasSwapped(true);
  }
  const swap = hasSwapped ? 'motion-safe:animate-text-swap' : undefined;

  useShortcut('home.newWorkspace', openNewWorkspace, !isCreating);
  useEscapeLayer(onCloseCreate, isCreating);

  const shown = useMemo(
    () =>
      filterWorkspaces({
        workspaces: sortWorkspacesByRecent(workspaces),
        projects,
        query: hasSearch ? query : '',
      }),
    [workspaces, projects, query, hasSearch],
  );

  const open = (workspace: Workspace) => {
    void openWorkspace({ id: workspace.id, title: workspace.name, onRunning: 'new-window' });
  };

  const openNewWindow = (workspace: Workspace) => {
    void openWorkspace({ id: workspace.id, title: workspace.name, target: 'new-window' });
  };

  const openFirstMatch = () => {
    const first = shown[0];
    if (first !== undefined) {
      open(first);
    }
  };

  const list = (
    <div key="list" className={cn('flex flex-col gap-6', swap)}>
      <div className="flex flex-col gap-3">
        <div className="flex min-h-7 items-center gap-2">
          <Eyebrow label="Workspaces" className="min-w-0 flex-1" />
          <Button size="sm" onClick={openNewWorkspace}>
            <Plus size={ICON_SIZE.row} aria-hidden />
            {NAMES.newWorkspace}
            <KeyHint keys={shortcutGlyphs('home.newWorkspace')} isOnTone />
          </Button>
        </div>
        {hasSearch ? (
          <SearchField
            size="md"
            value={query}
            onChange={setQuery}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                openFirstMatch();
              }
            }}
            placeholder="Search workspaces or folders"
            ariaLabel="Search workspaces or folders"
          />
        ) : null}
        {shown.length === 0 ? (
          <EmptyLine
            action={
              <Button size="xs" variant="quiet" onClick={() => setQuery('')}>
                Clear search
              </Button>
            }
          >
            No workspace matches.
          </EmptyLine>
        ) : (
          <ul
            aria-label="Workspaces"
            className="flex flex-col gap-0.5 overflow-hidden rounded-lg ring-1 ring-border-soft"
          >
            {shown.map((workspace) => (
              <WorkspaceRow
                key={workspace.id}
                workspace={workspace}
                home={home}
                onOpen={() => open(workspace)}
                onOpenNewWindow={() => openNewWindow(workspace)}
                onDisconnect={() => void disconnectWorkspace(workspace.id)}
              />
            ))}
          </ul>
        )}
      </div>
      <Switch
        label="Reopen the last workspace on launch"
        checked={isReopenLast}
        onChange={(next) => void saveSetting(SETTING_REOPEN_LAST, next ? '1' : '0')}
        className="w-fit"
      />
    </div>
  );

  const body = isCreating ? (
    <div key="new" className={swap}>
      <NewWorkspaceForm
        mode="new"
        titleRole="title"
        onCreated={onCloseCreate}
        onCancel={onCloseCreate}
        backLabel="Cancel"
      />
    </div>
  ) : workspaces.length === 0 ? (
    <div key="empty" className={swap}>
      <LauncherEmpty setup={setup} onNew={openNewWorkspace} />
    </div>
  ) : (
    list
  );

  return (
    <ScrollFade
      className="h-full w-full"
      viewportClassName="relative flex justify-center bg-background px-6"
    >
      <div data-tauri-drag-region aria-hidden className="absolute inset-x-0 top-0 h-9" />
      <div
        data-tauri-drag-region="false"
        className="absolute right-3 top-3 flex items-center gap-2"
      >
        <UpdatePill hasCard />
        <IconButton
          icon={CONCEPT_ICONS.settings}
          label="Open settings"
          shortcut="settings.open"
          variant="ghost"
          onClick={openSettingsHome}
        />
      </div>
      <main aria-label="Home" className="flex w-full max-w-[600px] flex-col gap-8 pb-10 pt-24">
        <div className="flex items-center gap-3">
          <BrandTile size={LOCKUP_TILE_PX} />
          <div className="flex flex-col">
            <h1 className="text-title text-foreground">Goodboy</h1>
            <span className="text-meta tabular-nums text-faint-foreground">v{APP_VERSION}</span>
          </div>
        </div>
        {body}
      </main>
    </ScrollFade>
  );
};
