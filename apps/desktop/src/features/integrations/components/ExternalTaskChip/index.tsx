import { ArrowRight } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { SessionExternalTask, SessionExternalTaskProvider } from '@goodboy/types';

type Props = {
  task: SessionExternalTask;
  variant?: 'full' | 'icon' | 'badge';
  onClick?: () => void;
  appearance?: 'chip' | 'row';
  ariaLabel?: string;
};

type ProviderMeta = {
  label: string;
  glyph: string;
  glyphClasses: string;
  colorClasses: string;
  studioEvent: string;
};

const PROVIDER_META: Record<SessionExternalTaskProvider, ProviderMeta> = {
  linear: {
    label: 'Linear',
    glyph: 'L',
    glyphClasses: 'bg-provider-linear text-white',
    colorClasses:
      'border-provider-linear/30 bg-provider-linear/5 text-provider-linear hover:border-provider-linear/60 hover:bg-provider-linear/10',
    studioEvent: 'goodboy:open-linear-studio',
  },
  sentry: {
    label: 'Sentry',
    glyph: 'S',
    glyphClasses: 'bg-provider-sentry text-white',
    colorClasses:
      'border-provider-sentry/30 bg-provider-sentry/5 text-provider-sentry hover:border-provider-sentry/60 hover:bg-provider-sentry/10',
    studioEvent: 'goodboy:open-sentry-studio',
  },
  gitlab: {
    label: 'GitLab',
    glyph: 'G',
    glyphClasses: 'bg-provider-gitlab text-white',
    colorClasses:
      'border-provider-gitlab/30 bg-provider-gitlab/5 text-provider-gitlab hover:border-provider-gitlab/60 hover:bg-provider-gitlab/10',
    studioEvent: 'goodboy:open-gitlab-studio',
  },
  github: {
    label: 'GitHub',
    glyph: 'GH',
    glyphClasses: 'bg-provider-github text-white',
    colorClasses:
      'border-provider-github/30 bg-provider-github/5 text-provider-github hover:border-provider-github/60 hover:bg-provider-github/10',
    studioEvent: 'goodboy:open-github-studio',
  },
};

export const ExternalTaskChip = ({
  task,
  variant = 'full',
  onClick,
  appearance = 'chip',
  ariaLabel,
}: Props) => {
  const meta = PROVIDER_META[task.provider];
  const tooltip = `${task.identifier}: ${task.title}`;
  const isRow = appearance === 'row';

  const glyph = (
    <span
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-[9px] font-bold',
        meta.glyphClasses,
      )}
    >
      {meta.glyph}
    </span>
  );

  if (variant === 'icon') {
    return (
      <span
        title={tooltip}
        aria-label={`${task.identifier} from ${meta.label}`}
        className="inline-flex shrink-0 items-center"
      >
        {glyph}
      </span>
    );
  }

  const handleClick =
    onClick ??
    (() =>
      window.dispatchEvent(
        new CustomEvent(meta.studioEvent, { detail: { issueExternalId: task.externalId } }),
      ));

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handleClick();
      }}
      title={tooltip}
      aria-label={ariaLabel ?? `open ${task.identifier} in ${meta.label} studio`}
      className={cn(
        isRow
          ? 'group flex w-full min-w-0 items-center gap-2 rounded-lg border border-border-soft bg-elevated px-3.5 py-2.5 text-left shadow-sm transition-colors hover:border-border'
          : 'inline-flex min-w-0 shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-medium transition-colors',
        !isRow && meta.colorClasses,
      )}
    >
      {glyph}
      <span className={cn('shrink-0 font-mono', isRow && 'text-xs font-semibold text-foreground')}>
        {task.identifier}
      </span>
      {variant === 'full' ? (
        <span className={cn('truncate', isRow && 'min-w-0 flex-1 text-sm text-foreground')}>
          {task.title}
        </span>
      ) : null}
      {isRow ? (
        <ArrowRight
          size={14}
          aria-hidden
          className="shrink-0 text-muted-foreground/30 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
        />
      ) : null}
    </button>
  );
};
