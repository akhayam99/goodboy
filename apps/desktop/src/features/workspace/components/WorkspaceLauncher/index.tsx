import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { useAppStore, useWorkspaces } from '../../../../store';
import { DogMascot } from '../../../../shared/components/DogMascot';
import { SETTING_REOPEN_LAST } from '../../../settings/settings';
import { WorkspaceRow } from '../WorkspaceRow';
import { filterWorkspaces, sortWorkspacesByRecent } from '../../recent';

export function WorkspaceLauncher() {
  const workspaces = useWorkspaces();
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const saveSetting = useAppStore((s) => s.saveSetting);
  const reopenLast = useAppStore((s) => s.settings[SETTING_REOPEN_LAST] === '1');
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
      if (picked) select(picked);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-background px-6 py-10">
      <div className="w-full max-w-xl motion-safe:animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <DogMascot size={56} className="mb-4 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Open a workspace</h1>
        </div>

        <div className="relative mb-6">
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

        <p className="mb-2 px-1 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Recent
        </p>
        <ul className="mb-6 space-y-0.5">
          {filtered.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              No workspaces found
            </li>
          ) : (
            filtered.map((w, i) => (
              <li key={w.id}>
                <WorkspaceRow
                  workspace={w}
                  density="card"
                  highlighted={i === activeIndex}
                  onOpen={() => select(w)}
                />
              </li>
            ))
          )}
        </ul>

        <button
          type="button"
          onClick={addWorkspace}
          className="flex items-center gap-1.5 rounded-md border border-border-soft px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground"
        >
          <Plus size={14} aria-hidden />
          New workspace
        </button>

        <label className="mt-6 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={reopenLast}
            onChange={(e) => void saveSetting(SETTING_REOPEN_LAST, e.target.checked ? '1' : '0')}
            className={cn('size-3.5 rounded border-border accent-[var(--color-primary)]')}
          />
          Reopen last workspace on launch
        </label>
      </div>
    </div>
  );
}
