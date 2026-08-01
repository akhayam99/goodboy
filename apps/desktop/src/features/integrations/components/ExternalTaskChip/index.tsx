import { cn } from '@goodboy/ui';
import type { SessionExternalTask, SessionExternalTaskProvider } from '@goodboy/types';
import { IntegrationGlyph } from '../IntegrationGlyph';
import { CopyLinkButton } from '../../../../shared/components/CopyLinkButton';
import { LinkedWorkRow } from '../../../../shared/components/LinkedWorkRow';

type Props = {
  task: SessionExternalTask;
  variant?: 'full' | 'icon' | 'badge';
  onClick?: () => void;
  appearance?: 'chip' | 'row';
  ariaLabel?: string;
};

type ProviderMeta = {
  label: string;
  colorClasses: string;
  studioEvent: string;
};

const PROVIDER_META: Record<SessionExternalTaskProvider, ProviderMeta> = {
  linear: {
    label: 'Linear',
    colorClasses:
      'border-provider-linear/30 bg-provider-linear/5 text-provider-linear hover:border-provider-linear/60 hover:bg-provider-linear/10',
    studioEvent: 'goodboy:open-linear-studio',
  },
  sentry: {
    label: 'Sentry',
    colorClasses:
      'border-provider-sentry/30 bg-provider-sentry/5 text-provider-sentry hover:border-provider-sentry/60 hover:bg-provider-sentry/10',
    studioEvent: 'goodboy:open-sentry-studio',
  },
  gitlab: {
    label: 'GitLab',
    colorClasses:
      'border-provider-gitlab/30 bg-provider-gitlab/5 text-provider-gitlab hover:border-provider-gitlab/60 hover:bg-provider-gitlab/10',
    studioEvent: 'goodboy:open-gitlab-studio',
  },
  github: {
    label: 'GitHub',
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

  const glyph = <IntegrationGlyph provider={task.provider} />;

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

  if (appearance === 'row') {
    return (
      <LinkedWorkRow
        leading={{ kind: 'glyph', provider: task.provider }}
        identifier={task.identifier}
        title={variant === 'full' ? task.title : undefined}
        onClick={handleClick}
        ariaLabel={ariaLabel ?? `open ${task.identifier} in ${meta.label} studio`}
        tooltip={tooltip}
        actions={
          task.url !== '' ? <CopyLinkButton url={task.url} label={task.identifier} /> : undefined
        }
      />
    );
  }

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
        'inline-flex min-w-0 shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-medium transition-colors',
        meta.colorClasses,
      )}
    >
      {glyph}
      <span className="shrink-0 font-mono">{task.identifier}</span>
      {variant === 'full' ? <span className="truncate">{task.title}</span> : null}
    </button>
  );
};
