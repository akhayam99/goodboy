import { cn } from '@goodboy/ui';
import type { SessionExternalTask, SessionExternalTaskProvider } from '@goodboy/types';

type ExternalTaskChipProps = {
  task: SessionExternalTask;
  variant?: 'full' | 'icon';
  onClick?: () => void;
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
};

export const ExternalTaskChip = ({ task, variant = 'full', onClick }: ExternalTaskChipProps) => {
  const meta = PROVIDER_META[task.provider];
  const tooltip = `${task.identifier}: ${task.title}`;

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
      onClick={handleClick}
      title={tooltip}
      aria-label={`open ${task.identifier} in ${meta.label} studio`}
      className={cn(
        'inline-flex min-w-0 shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-medium transition-colors',
        meta.colorClasses,
      )}
    >
      {glyph}
      <span className="shrink-0 font-mono">{task.identifier}</span>
      <span className="truncate">{task.title}</span>
    </button>
  );
};
