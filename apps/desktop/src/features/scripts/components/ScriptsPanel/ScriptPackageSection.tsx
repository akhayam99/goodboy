import type { ReactNode } from 'react';
import { ChevronRight, Package } from 'lucide-react';
import { StatusDot, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ScriptPackageSection as Section } from '../../groupScriptsByPackage';

type Props = {
  readonly section: Section;
  readonly isCollapsed: boolean;
  readonly runningCount: number;
  readonly onToggle: () => void;
  readonly children: ReactNode;
};

export const ScriptPackageSection = ({
  section,
  isCollapsed,
  runningCount,
  onToggle,
  children,
}: Props) => (
  <section aria-label={`${section.packageName} scripts`} className="flex flex-col gap-0.5">
    <button
      type="button"
      aria-expanded={!isCollapsed}
      onClick={onToggle}
      className="flex h-7 min-w-0 items-center gap-2 rounded-sm px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <ChevronRight
        size={ICON_SIZE.row}
        aria-hidden
        className={cn(
          'shrink-0 text-faint-foreground motion-safe:transition-transform',
          !isCollapsed && 'rotate-90',
        )}
      />
      <Package size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
      <span className="truncate text-secondary text-muted-foreground">{section.packageName}</span>
      {section.relDir === '' ? null : (
        <span className="min-w-0 truncate font-mono text-meta text-faint-foreground">
          {section.relDir}
        </span>
      )}
      <span className="shrink-0 text-secondary tabular-nums text-faint-foreground">
        {section.scripts.length}
      </span>
      {runningCount === 0 ? null : (
        <span className="flex shrink-0 items-center gap-1 text-secondary text-info">
          <StatusDot tone="info" size="sm" pulsing />
          {runningCount} running
        </span>
      )}
    </button>
    {isCollapsed ? null : children}
  </section>
);
