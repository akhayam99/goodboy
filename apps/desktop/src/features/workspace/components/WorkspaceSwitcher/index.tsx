import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Workspace } from '@goodboy/types';
import { useAppStore, useWorkspaces } from '../../../../store';
import { WorkspaceRow } from '../WorkspaceRow';
import { filterWorkspaces, sortWorkspacesByRecent } from '../../recent';

type Props = {
  onClose: () => void;
};

export const WorkspaceSwitcher = ({ onClose }: Props) => {
  const workspaces = useWorkspaces();
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(
    () => filterWorkspaces(sortWorkspacesByRecent(workspaces), query),
    [workspaces, query],
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
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[18vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-background shadow-2xl motion-safe:animate-fade-in">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Switch or open a workspace…"
          className="w-full border-b border-border bg-background px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        />
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">No workspaces</li>
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
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('goodboy:add-workspace'));
            onClose();
          }}
          className="flex w-full items-center gap-2 border-t border-border-soft px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <Plus size={14} aria-hidden />
          New workspace
        </button>
      </div>
    </div>
  );
};
