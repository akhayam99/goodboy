import { useEffect, useMemo, useRef } from 'react';
import { Filter, X } from 'lucide-react';
import { AnchoredPopover, cn, Divider, Eyebrow, Tooltip, useDropdown } from '@goodboy/ui';
import type { Session, WorkspaceId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  NO_PROJECT_FILTER_ID,
  useAppStore,
  useSelectedProjectIds,
} from '../../../../store';
import { ProjectFilterOption } from './ProjectFilterOption';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessions: ReadonlyArray<Session>;
};

type FilterOption = {
  readonly id: string;
  readonly label: string;
  readonly count: number;
};

type UpdateOptionParams = {
  readonly id: string;
  readonly checked: boolean;
};

const MENU_WIDTH = {
  className: 'w-[240px]',
  expected: 240,
};

export const ProjectFilter = ({ workspaceId, sessions }: Props) => {
  const selectedProjectIds = useSelectedProjectIds({ workspaceId });
  const setSelectedProjectIds = useAppStore((state) => state.setSelectedProjectIds);
  const projects = useAppStore((state) => state.projects);
  const sessionProjectMounts = useAppStore((state) => state.sessionProjectMounts);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdown = useDropdown({
    align: 'end',
    width: MENU_WIDTH.className,
    expectedWidth: MENU_WIDTH.expected,
    expectedHeight: 300,
    isEscapeEnabled: false,
  });
  const { close, open, toggle } = dropdown;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      close();
      triggerRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, open]);

  const options = useMemo(() => {
    const counts = new Map<string, number>();
    let noProjectCount = 0;
    for (const session of sessions) {
      const mounts = sessionProjectMounts[session.id] ?? EMPTY_ARRAY;
      if (mounts.length === 0) {
        noProjectCount += 1;
        continue;
      }
      for (const projectId of new Set(mounts.map((mount) => mount.projectId))) {
        counts.set(projectId, (counts.get(projectId) ?? 0) + 1);
      }
    }
    const projectOptions: ReadonlyArray<FilterOption> = projects
      .filter((project) => project.workspaceId === workspaceId && counts.has(project.id))
      .map((project) => ({
        id: project.id,
        label: project.name,
        count: counts.get(project.id) ?? 0,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
    if (noProjectCount === 0) {
      return projectOptions;
    }
    return [
      ...projectOptions,
      { id: NO_PROJECT_FILTER_ID, label: 'No project', count: noProjectCount },
    ];
  }, [projects, sessionProjectMounts, sessions, workspaceId]);

  const updateOption = ({ id, checked }: UpdateOptionParams) => {
    const next = checked
      ? [...selectedProjectIds, id]
      : selectedProjectIds.filter((selectedId) => selectedId !== id);
    setSelectedProjectIds({ workspaceId, selectedProjectIds: next });
  };

  const activeCount = selectedProjectIds.length;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Filter sessions by project"
      className="py-1"
      hasBackdrop
      trigger={
        <Tooltip content="Filter by project" side="bottom">
          <button
            ref={triggerRef}
            type="button"
            onClick={toggle}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={
              activeCount > 0 ? `Project filter, ${activeCount} active` : 'Project filter'
            }
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-2xs font-medium motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
              activeCount > 0 || open
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground/70 hover:bg-foreground/10 hover:text-foreground',
            )}
          >
            <Filter size={11} aria-hidden />
            {activeCount > 0 ? <span className="tabular-nums">{activeCount}</span> : null}
          </button>
        </Tooltip>
      }
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <Eyebrow label="Projects" muted />
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={() => setSelectedProjectIds({ workspaceId, selectedProjectIds: [] })}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          >
            <X size={10} aria-hidden />
            Clear
          </button>
        ) : null}
      </div>
      <Divider />
      <div className="flex max-h-64 flex-col overflow-y-auto p-1">
        {options.length === 0 ? (
          <span className="px-2 py-3 text-xs text-muted-foreground">No mounted projects</span>
        ) : (
          options.map((option) => (
            <ProjectFilterOption
              key={option.id}
              label={option.label}
              count={option.count}
              checked={selectedProjectIds.includes(option.id)}
              onChange={(checked) => updateOption({ id: option.id, checked })}
            />
          ))
        )}
      </div>
    </AnchoredPopover>
  );
};
