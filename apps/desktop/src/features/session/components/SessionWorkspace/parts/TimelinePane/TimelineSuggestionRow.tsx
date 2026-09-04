import {
  CircleHelp,
  FolderGit2,
  GitPullRequest,
  GitPullRequestArrow,
  Waypoints,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, Tooltip, cn, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import type { SessionSuggestion } from '../../../../../suggestions';
import type { SuggestionActions } from '../../../../../suggestions/useSuggestionActions';
import { futureRailRow, railColumnX } from '../../../../timeline/railGeometry';
import { TIMELINE_RHYTHM } from '../../../../timeline/timelineRhythm';
import { TIMELINE_GUTTER, TIMELINE_SURFACE_FILL } from './timelineLayout';
import { TimelineRail } from './TimelineRail';

const ROW_HEIGHT = 32;

const ICONS: Record<SessionSuggestion['kind'], LucideIcon> = {
  'workflow-next-step': Waypoints,
  'plan-ready': CONCEPT_ICONS.suggestion,
  'resolve-threads': GitPullRequest,
  'rebase-project': GitPullRequestArrow,
  'answer-questions': CircleHelp,
  'mount-project': FolderGit2,
};

type Props = {
  readonly suggestion: SessionSuggestion;
  readonly railWidth: number;
  readonly actions: SuggestionActions;
};

export const TimelineSuggestionRow = ({ suggestion, railWidth, actions }: Props) => {
  const Icon = ICONS[suggestion.kind];
  const { markerSize, glyphSize } = TIMELINE_RHYTHM.grade.entry;
  const rail = futureRailRow({ id: suggestion.id, height: ROW_HEIGHT });
  return (
    <div
      data-testid={`timeline-suggestion-${suggestion.id}`}
      className="flex min-w-0"
      style={{ height: ROW_HEIGHT }}
    >
      <span className={cn('shrink-0', TIMELINE_GUTTER)} />
      <span className="relative shrink-0" style={{ width: railWidth }}>
        <TimelineRail rail={rail} width={railWidth} />
        <span
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: railColumnX({ column: 0 }), top: ROW_HEIGHT / 2 }}
        >
          <span
            className={cn(
              'inline-flex items-center justify-center rounded-full border border-dashed',
              TIMELINE_SURFACE_FILL,
              tintClasses('info').border,
            )}
            style={{ width: markerSize, height: markerSize }}
          >
            <Icon size={glyphSize} aria-hidden className={tintClasses('info').icon} />
          </span>
        </span>
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2 pl-2 pr-1.5">
        <span className="truncate text-xs font-medium text-foreground">{suggestion.title}</span>
        {suggestion.detail == null ? null : (
          <span className="truncate text-2xs text-muted-foreground">{suggestion.detail}</span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-0.5">
          {actions.primary == null ? null : (
            <Button
              variant="ghost"
              size="sm"
              className="h-6"
              disabled={actions.primary.isDisabled}
              onClick={actions.primary.onAct}
            >
              {actions.primary.label}
            </Button>
          )}
          {actions.onDismiss == null ? null : (
            <Tooltip content="Dismiss this suggestion">
              <button
                type="button"
                onClick={actions.onDismiss}
                aria-label="Dismiss this suggestion"
                className="rounded-md p-1 text-muted-foreground motion-safe:transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]"
              >
                <X size={12} aria-hidden />
              </button>
            </Tooltip>
          )}
        </span>
      </div>
    </div>
  );
};
