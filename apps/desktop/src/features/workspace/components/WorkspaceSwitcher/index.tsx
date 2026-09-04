import { useEffect, useMemo, useRef, useState } from 'react';
import { FolderGit2, Plus } from 'lucide-react';
import { Divider, EmptyState, ScrollFade } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { useAppStore, useWorkspaces } from '../../../../store';
import { WorkspaceRow } from '../WorkspaceRow';
import { filterWorkspaces, sortWorkspacesByRecent } from '../../recent';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly onClose: () => void;
};

const actionClass =
  'flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground';

export const WorkspaceSwitcher = ({ onClose }: Props) => {
  const workspaces = useWorkspaces();
  const projects = useAppStore((s) => s.projects);
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

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
    onClose();
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
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Switch or open a workspace…"
        aria-label="Filter workspaces"
        className="w-full bg-transparent px-3 py-2.5 text-xs focus-visible:outline-none"
      />
      <Divider />
      <ScrollFade className="max-h-96" viewportClassName="p-1" fadeFrom="elevated">
        <ul>
          {filtered.length === 0 ? (
            <li>
              <EmptyState
                icon={CONCEPT_ICONS.workspace}
                tone={CONCEPT_TONE.workspace}
                title="No workspaces"
                size="inline"
                className="px-3 py-5"
              />
            </li>
          ) : (
            filtered.map((w, i) => (
              <li key={w.id}>
                <WorkspaceRow
                  workspace={w}
                  density="row"
                  highlighted={i === activeIndex}
                  onOpen={() => select(w)}
                />
              </li>
            ))
          )}
        </ul>
      </ScrollFade>
      <Divider />
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(new CustomEvent('goodboy:add-workspace'));
          onClose();
        }}
        className={actionClass}
      >
        <Plus size={13} aria-hidden />
        New workspace
      </button>
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(
            new CustomEvent('goodboy:open-settings', {
              detail: { scope: 'workspace', section: 'projects' },
            }),
          );
          onClose();
        }}
        className={actionClass}
      >
        <FolderGit2 size={13} aria-hidden />
        Manage projects
      </button>
    </>
  );
};
