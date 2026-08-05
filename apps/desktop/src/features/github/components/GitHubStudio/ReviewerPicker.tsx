import { useEffect, useRef, useState } from 'react';
import { EmptyState, ScrollFade, Skeleton } from '@goodboy/ui';
import { Plus, Search } from 'lucide-react';
import { useCurrentWorkspace } from '../../../../store';
import type { WorkspaceId } from '@goodboy/types';
import { ghRepoCollaborators } from '../../github';
import { NoteAvatar } from '../../../../shared/components/NoteAvatar';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly workspaceRoot: string | null;
  readonly memberWorkspaceId?: WorkspaceId;
  readonly exclude: ReadonlySet<string>;
  readonly onAdd: (logins: ReadonlyArray<string>) => void;
};

export const ReviewerPicker = ({ workspaceRoot, memberWorkspaceId, exclude, onAdd }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [logins, setLogins] = useState<ReadonlyArray<string> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const workspaceId = useCurrentWorkspace()?.id;

  useEffect(() => {
    if (isOpen === false) {
      return;
    }

    const onDocumentMouseDown = (event: MouseEvent) => {
      if (ref.current != null && ref.current.contains(event.target as Node) === false) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => document.removeEventListener('mousedown', onDocumentMouseDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen === false || logins !== null || workspaceRoot == null || workspaceRoot === '') {
      return;
    }

    setIsLoading(true);
    void ghRepoCollaborators(workspaceRoot, workspaceId, memberWorkspaceId)
      .then(setLogins)
      .catch(() => setLogins([]))
      .finally(() => setIsLoading(false));
  }, [isOpen, logins, memberWorkspaceId, workspaceRoot, workspaceId]);

  const candidates = (logins ?? [])
    .filter((login) => exclude.has(login.toLowerCase()) === false)
    .filter((login) => login.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 8);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((value) => value === false)}
        title="Request review"
        aria-label="Request review"
        className="inline-flex items-center gap-0.5 rounded-md border border-border-soft px-1.5 py-0.5 text-3xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
      >
        <Plus size={11} aria-hidden />
        Add
      </button>
      {isOpen ? (
        <div className="absolute left-0 top-6 z-10 flex w-52 flex-col gap-1 rounded-md border border-border-soft bg-background p-1.5 shadow-lg">
          <div className="flex items-center gap-1.5 px-1.5 py-1">
            <Search size={12} aria-hidden className="shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="filter collaborators"
              className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/60"
            />
          </div>
          {isLoading ? (
            <div className="flex flex-col gap-1 px-1.5 py-1" role="status" aria-label="Loading">
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <Skeleton className="size-4 shrink-0 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <EmptyState
              icon={CONCEPT_ICONS.search}
              tone={CONCEPT_TONE.search}
              title="No matches"
              size="inline"
              className="px-1.5 py-1"
            />
          ) : (
            <ScrollFade className="max-h-44" fadeSize={16}>
              <ul>
                {candidates.map((login) => (
                  <li key={login}>
                    <button
                      type="button"
                      onClick={() => {
                        onAdd([login]);
                        setIsOpen(false);
                        setQuery('');
                      }}
                      className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs text-foreground hover:bg-muted/60"
                    >
                      <NoteAvatar url={null} alt={login} size="xs" />
                      <span className="min-w-0 flex-1 truncate">{login}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollFade>
          )}
        </div>
      ) : null}
    </div>
  );
};
