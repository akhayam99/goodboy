import { Folder, FolderGit2 } from 'lucide-react';
import { cn, SectionHeader } from '@goodboy/ui';
import type { Project, ProjectId } from '@goodboy/types';

type Props = {
  readonly projects: ReadonlyArray<Project>;
  readonly selectedProjectId: ProjectId | null;
  readonly onSelect: (projectId: ProjectId) => void;
  readonly busy: boolean;
};

export const ProjectChoice = ({ projects, selectedProjectId, onSelect, busy }: Props) => {
  return (
    <section className="flex flex-col gap-1.5">
      <SectionHeader
        icon={<FolderGit2 size={12} aria-hidden />}
        label="Which project?"
        hint="The session gets its own worktree inside the project you pick."
      />
      <div role="group" aria-label="Project for this session" className="flex flex-col gap-1">
        {projects.map((project) => {
          const GlyphIcon = project.kind === 'repo' ? FolderGit2 : Folder;
          const isSelected = project.id === selectedProjectId;
          return (
            <button
              key={project.id}
              type="button"
              disabled={busy}
              aria-pressed={isSelected}
              onClick={() => onSelect(project.id)}
              className={cn(
                'flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left ring-1 motion-safe:transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
                isSelected
                  ? 'bg-primary/10 ring-primary/40'
                  : 'bg-muted/20 ring-border-soft hover:bg-foreground/5',
              )}
            >
              <GlyphIcon size={13} aria-hidden className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                {project.name}
              </span>
              <span className="shrink-0 text-2xs text-muted-foreground/70">{project.kind}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
