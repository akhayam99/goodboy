import { useId, type ReactNode } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronRight } from 'lucide-react';
import { Button, IconButton, ROW_INTERACTIVE, Reveal, Tooltip, cn } from '@goodboy/ui';
import type { Project } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { RepoRowFacts, RepoRowGlyph, RepoRowTone } from './repoRowFactsOf';

type Props = {
  readonly project: Project;
  readonly base: string | null;
  readonly facts: RepoRowFacts;
  readonly isOpen: boolean;
  readonly isChecking: boolean;
  readonly detail: ReactNode;
  readonly onToggle: () => void;
  readonly onPull: () => void;
  readonly onRetry: () => void;
  readonly onReveal: () => void;
  readonly onOpenEditor: () => void;
};

const TONE_CLASS: Readonly<Record<RepoRowTone, string>> = {
  info: 'text-info',
  warning: 'text-warning',
  danger: 'text-danger',
  muted: 'text-muted-foreground',
  faint: 'text-faint-foreground',
};

type GlyphParams = {
  readonly glyph: RepoRowGlyph;
};

const glyphOf = ({ glyph }: GlyphParams) => {
  switch (glyph) {
    case 'behind':
      return <ArrowDown size={ICON_SIZE.mark} aria-hidden />;
    case 'ahead':
      return <ArrowUp size={ICON_SIZE.mark} aria-hidden />;
    case 'diverged':
      return <ArrowUpDown size={ICON_SIZE.mark} aria-hidden />;
    case 'up-to-date':
      return <Check size={ICON_SIZE.mark} aria-hidden />;
    case 'failed':
      return <AlertTriangle size={ICON_SIZE.mark} aria-hidden />;
    case 'none':
      return null;
    default: {
      const exhaustive: never = glyph;
      return exhaustive;
    }
  }
};

type PrimaryParams = Pick<
  Props,
  'project' | 'base' | 'facts' | 'isChecking' | 'onPull' | 'onRetry'
>;

const primaryOf = ({ project, base, facts, isChecking, onPull, onRetry }: PrimaryParams) => {
  if (facts.isPullable || facts.isPulling) {
    return (
      <Button
        size="xs"
        variant="secondary"
        disabled={facts.isPulling}
        aria-label={`Pull ${base ?? 'the base branch'} in ${project.name}`}
        onClick={onPull}
      >
        Pull
      </Button>
    );
  }
  if (facts.isFailed) {
    return (
      <Button
        size="xs"
        variant="secondary"
        disabled={isChecking}
        aria-label={`Retry the check of ${project.name}`}
        onClick={onRetry}
      >
        Retry
      </Button>
    );
  }
  return (
    <span aria-hidden data-pull-slot="" className="invisible shrink-0">
      <Button size="xs" variant="secondary" disabled tabIndex={-1}>
        Retry
      </Button>
    </span>
  );
};

export const RepoEntryRow = ({
  project,
  base,
  facts,
  isOpen,
  isChecking,
  detail,
  onToggle,
  onPull,
  onRetry,
  onReveal,
  onOpenEditor,
}: Props) => {
  const detailId = useId();
  const hasMeta = base !== null || facts.note !== null;
  return (
    <div data-repo-row={project.name} className="flex flex-col gap-1">
      <div className="flex min-w-0 flex-col rounded-md px-2">
        <div className="flex h-7 min-w-0 items-center gap-2">
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={detailId}
            aria-label={project.name}
            onClick={onToggle}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-1 rounded-sm text-left text-row',
              ROW_INTERACTIVE,
            )}
          >
            <ChevronRight
              size={ICON_SIZE.control}
              aria-hidden
              className={cn(
                'shrink-0 text-faint-foreground motion-safe:transition-transform',
                isOpen && 'rotate-90',
              )}
            />
            <span className="truncate">{project.name}</span>
          </button>
          <Tooltip content={facts.tooltip}>
            <span
              tabIndex={0}
              className={cn('flex shrink-0 items-center gap-1 text-meta', TONE_CLASS[facts.tone])}
            >
              {glyphOf({ glyph: facts.glyph })}
              {facts.word}
            </span>
          </Tooltip>
          {primaryOf({ project, base, facts, isChecking, onPull, onRetry })}
          <IconButton
            icon={CONCEPT_ICONS.folderOpen}
            label={`Show ${project.name} in Finder`}
            tooltip="Show in Finder"
            size="xs"
            iconSize={ICON_SIZE.row}
            onClick={onReveal}
          />
          <IconButton
            icon={CONCEPT_ICONS.editor}
            label={`Open ${project.name} in the editor`}
            tooltip="Open in editor"
            size="xs"
            iconSize={ICON_SIZE.row}
            onClick={onOpenEditor}
          />
        </div>
        {!hasMeta ? null : (
          <span className="pl-[calc(14px+4px)] text-meta text-muted-foreground">
            {base === null ? null : <span className="font-mono">{base}</span>}
            {base !== null && facts.note !== null ? ' · ' : null}
            {facts.note === null ? null : <span>{facts.note}</span>}
          </span>
        )}
      </div>
      <Reveal open={isOpen} id={detailId}>
        {detail}
      </Reveal>
    </div>
  );
};
