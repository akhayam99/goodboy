import { useId, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { RefreshIconButton, cn } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { SessionScriptGroup } from '../../buildSessionScripts';

type Props = {
  readonly group: SessionScriptGroup;
  readonly count: number;
  readonly isCollapsed: boolean;
  readonly isRefreshing: boolean;
  readonly editor: ReactNode;
  readonly note: ReactNode;
  readonly children: ReactNode;
  readonly onToggle: () => void;
  readonly onRefresh: () => void;
};

export const ScriptGroupSection = ({
  group,
  count,
  isCollapsed,
  isRefreshing,
  editor,
  note,
  children,
  onToggle,
  onRefresh,
}: Props) => {
  const bodyId = useId();
  const ProjectIcon = CONCEPT_ICONS.projectRepo;
  const BranchIcon = CONCEPT_ICONS.branch;
  const label = group.branch === '' ? group.projectName : `${group.projectName} · ${group.branch}`;

  return (
    <section aria-label={label} className="flex flex-col gap-1">
      <header className="flex h-7 items-center gap-2 px-1">
        <button
          type="button"
          aria-expanded={!isCollapsed}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <ChevronRight
            size={ICON_SIZE.row}
            aria-hidden
            className={cn(
              'shrink-0 text-faint-foreground motion-safe:transition-transform',
              !isCollapsed && 'rotate-90',
            )}
          />
          <ProjectIcon
            size={ICON_SIZE.row}
            aria-hidden
            className="shrink-0 text-faint-foreground"
          />
          <span className="truncate text-row text-foreground">{group.projectName}</span>
          {group.branch === '' ? null : (
            <span className="flex min-w-0 items-center gap-1 text-secondary text-faint-foreground">
              <BranchIcon size={ICON_SIZE.row} aria-hidden className="shrink-0" />
              <span className="truncate">{group.branch}</span>
            </span>
          )}
          <span className="shrink-0 text-secondary tabular-nums text-muted-foreground">
            {count}
          </span>
        </button>
        {group.isReady ? (
          <RefreshIconButton
            label={`Read ${group.projectName} scripts again`}
            isLoading={isRefreshing}
            onClick={onRefresh}
          />
        ) : null}
      </header>
      {isCollapsed ? null : (
        <div id={bodyId} className="flex flex-col gap-0.5">
          {editor}
          {children}
          {note}
        </div>
      )}
    </section>
  );
};
