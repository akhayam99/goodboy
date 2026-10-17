import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Check } from 'lucide-react';
import { Button, ROW_INTERACTIVE, Tooltip, cn } from '@goodboy/ui';
import type { Project } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { RepoRowFacts, RepoRowGlyph, RepoRowTone } from './repoRowFactsOf';

type Props = {
  readonly project: Project;
  readonly base: string | null;
  readonly facts: RepoRowFacts;
  readonly onOpen: () => void;
  readonly onPull: () => void;
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

export const RepoEntryRow = ({ project, base, facts, onOpen, onPull }: Props) => (
  <div data-repo-row={project.name} className="flex flex-col gap-0.5 px-3">
    <div className="flex h-7 min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        className={cn('min-w-0 flex-1 truncate rounded-sm text-left text-row', ROW_INTERACTIVE)}
      >
        {project.name}
      </button>
      {base === null ? null : (
        <span className="shrink-0 font-mono text-meta text-muted-foreground">{base}</span>
      )}
      <Tooltip content={facts.tooltip}>
        <span
          tabIndex={0}
          className={cn('flex shrink-0 items-center gap-1 text-meta', TONE_CLASS[facts.tone])}
        >
          {glyphOf({ glyph: facts.glyph })}
          {facts.word}
        </span>
      </Tooltip>
      {facts.isPullable || facts.isPulling ? (
        <Button
          size="xs"
          variant="secondary"
          disabled={facts.isPulling}
          aria-label={`Pull ${base ?? 'the base branch'} in ${project.name}`}
          onClick={onPull}
        >
          Pull
        </Button>
      ) : (
        <span aria-hidden data-pull-slot="" className="invisible shrink-0">
          <Button size="xs" variant="secondary" disabled tabIndex={-1}>
            Pull
          </Button>
        </span>
      )}
    </div>
    {facts.note === null ? null : (
      <span className="text-meta text-muted-foreground">{facts.note}</span>
    )}
  </div>
);
