import { useState } from 'react';
import { FolderGit2 } from 'lucide-react';
import { Button, Checkbox } from '@goodboy/ui';
import type { ChildRepo } from '../../lib/repo';

export type KnownRepo = {
  readonly workspaceName: string;
  readonly sessionCount: number;
};

type Props = {
  readonly repos: ReadonlyArray<ChildRepo>;
  readonly busy: boolean;
  readonly known?: Readonly<Record<string, KnownRepo>>;
  readonly onConfirm: (params: { readonly paths: ReadonlyArray<string> }) => void;
  readonly onDismiss: () => void;
};

const knownLabel = ({ entry }: { readonly entry: KnownRepo }): string => {
  const sessions = entry.sessionCount === 1 ? '1 session' : `${entry.sessionCount} sessions`;
  return `already in ${entry.workspaceName} with ${sessions}, moves here when linked`;
};

export const DetectedRepoList = ({ repos, busy, known = {}, onConfirm, onDismiss }: Props) => {
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const selected = repos.filter((repo) => !excluded.has(repo.path));

  const toggle = ({ path, next }: { readonly path: string; readonly next: boolean }) => {
    setExcluded((current) => {
      const draft = new Set(current);
      if (next) {
        draft.delete(path);
      }
      if (!next) {
        draft.add(path);
      }
      return draft;
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-soft/60 bg-subtle/20 p-3 text-left">
      <p className="text-xs text-muted-foreground">
        {repos.length === 1
          ? '1 repository found in this folder'
          : `${repos.length} repositories found in this folder`}
      </p>
      <ul className="flex flex-col gap-2">
        {repos.map((repo) => {
          const knownEntry = known[repo.path];
          return (
            <li key={repo.path}>
              <Checkbox
                checked={!excluded.has(repo.path)}
                disabled={busy}
                onChange={(next) => toggle({ path: repo.path, next })}
                ariaLabel={`Link ${repo.name}`}
                className="w-full min-w-0"
                label={
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <FolderGit2
                        size={14}
                        aria-hidden
                        className="shrink-0 text-muted-foreground"
                      />
                      <span className="truncate text-sm font-medium text-foreground">
                        {repo.name}
                      </span>
                      <span className="truncate font-mono text-xs text-muted-foreground/70">
                        {repo.path}
                      </span>
                    </span>
                    {knownEntry !== undefined ? (
                      <span className="block truncate text-xs text-primary">
                        {knownLabel({ entry: knownEntry })}
                      </span>
                    ) : null}
                  </span>
                }
              />
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={busy || selected.length === 0}
          onClick={() => onConfirm({ paths: selected.map((repo) => repo.path) })}
        >
          {selected.length === 1 ? 'Link 1 project' : `Link ${selected.length} projects`}
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={onDismiss}>
          Cancel
        </Button>
      </div>
    </div>
  );
};
