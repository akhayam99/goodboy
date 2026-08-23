import { useEffect, useState } from 'react';
import { cn, EmptyState, Popover, ScrollFade, Skeleton, useDropdown } from '@goodboy/ui';
import { Plus, Search } from 'lucide-react';
import { useCurrentWorkspace } from '../../../../store';
import type { ProjectId } from '@goodboy/types';
import { ghRepoCollaborators } from '../../github';
import { Avatar } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly projectRoot: string | null;
  readonly projectId?: ProjectId;
  readonly exclude: ReadonlySet<string>;
  readonly onAdd: (logins: ReadonlyArray<string>) => void;
};

export const ReviewerPicker = ({ projectRoot, projectId, exclude, onAdd }: Props) => {
  const [query, setQuery] = useState('');
  const [logins, setLogins] = useState<ReadonlyArray<string> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const workspaceId = useCurrentWorkspace()?.id;
  const {
    open: isOpen,
    close,
    toggle,
    containerRef,
    popupRef,
    popupClassName,
  } = useDropdown({ width: 'w-52', expectedHeight: 220 });

  useEffect(() => {
    if (isOpen === false || logins !== null || projectRoot == null || projectRoot === '') {
      return;
    }

    setIsLoading(true);
    void ghRepoCollaborators(projectRoot, workspaceId, projectId)
      .then(setLogins)
      .catch(() => setLogins([]))
      .finally(() => setIsLoading(false));
  }, [isOpen, logins, projectId, projectRoot, workspaceId]);

  const candidates = (logins ?? [])
    .filter((login) => exclude.has(login.toLowerCase()) === false)
    .filter((login) => login.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 8);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        title="Request review"
        aria-label="Request review"
        className="inline-flex items-center gap-0.5 rounded-md border border-border-soft px-1.5 py-0.5 text-3xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
      >
        <Plus size={11} aria-hidden />
        Add
      </button>
      {isOpen ? (
        <Popover innerRef={popupRef} className={cn(popupClassName, 'flex flex-col gap-1 p-1.5')}>
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
                        close();
                        setQuery('');
                      }}
                      className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs text-foreground hover:bg-muted/60"
                    >
                      <Avatar url={null} alt={login} size="xs" />
                      <span className="min-w-0 flex-1 truncate">{login}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollFade>
          )}
        </Popover>
      ) : null}
    </div>
  );
};
