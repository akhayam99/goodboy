import { useMemo, useState } from 'react';
import { Folder, FolderGit2, Plus } from 'lucide-react';
import { AnchoredPopover, ScrollFade, cn, formatError, useDropdown } from '@goodboy/ui';
import type { Project, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';

const MANUAL_REASON = 'added manually by the user';
const SEARCH_THRESHOLD = 8;

type Props = {
  readonly sessionId: SessionId;
  readonly projects: ReadonlyArray<Project>;
};

type MountParams = {
  readonly project: Project;
};

export const MountProjectPopover = ({ sessionId, projects }: Props) => {
  const materializeProject = useAppStore((state) => state.materializeProject);
  const emitNotification = useAppStore((state) => state.emitNotification);
  const [query, setQuery] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const dropdown = useDropdown({ expectedHeight: 280, width: 'w-72' });
  const { open, toggle, close } = dropdown;
  const isSearchable = projects.length > SEARCH_THRESHOLD;
  const filtered = useMemo(
    () => projects.filter((project) => project.name.toLowerCase().includes(query.toLowerCase())),
    [projects, query],
  );

  const mountProject = async ({ project }: MountParams) => {
    setIsBusy(true);
    try {
      await materializeProject({ sessionId, projectId: project.id, reason: MANUAL_REASON });
      setQuery('');
      close();
    } catch (error) {
      void emitNotification('error', 'warning', 'could not add the project', formatError(error), {
        sessionId,
        workspaceId: project.workspaceId,
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Mount another project"
      trigger={
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={toggle}
          className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border-soft px-3 py-2 text-left text-xs leading-5 text-muted-foreground motion-safe:transition-colors hover:bg-muted/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <Plus size={13} aria-hidden className="shrink-0" />
          Mount another project
        </button>
      }
    >
      <div className="flex flex-col">
        {isSearchable ? (
          <input
            type="text"
            value={query}
            aria-label="Search projects"
            placeholder="Search projects…"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            className="border-b border-border-soft bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
          />
        ) : null}
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">No matching projects</p>
        ) : (
          <ScrollFade className="max-h-56" viewportClassName="py-0.5" fadeFrom="subtle">
            <ul>
              {filtered.map((project) => {
                const GlyphIcon = project.kind === 'repo' ? FolderGit2 : Folder;
                return (
                  <li key={project.id}>
                    <button
                      type="button"
                      disabled={isBusy}
                      aria-label={`Mount ${project.name}`}
                      onClick={() => void mountProject({ project })}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-foreground motion-safe:transition-colors hover:bg-muted/40',
                        isBusy && 'pointer-events-none opacity-50',
                      )}
                    >
                      <GlyphIcon size={13} aria-hidden className="shrink-0 text-muted-foreground" />
                      <span className="truncate">{project.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollFade>
        )}
      </div>
    </AnchoredPopover>
  );
};
