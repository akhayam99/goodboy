import { Chip, cn } from '@goodboy/ui';
import type { SessionExternalTask, SessionExternalTaskProvider } from '@goodboy/types';
import { IntegrationGlyph } from '../IntegrationGlyph';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import { LinkedWorkRow } from '../../../../shared/components/LinkedWorkRow';
import { openUrl } from '../../../../shared/lib/editor';

type Props = {
  task: SessionExternalTask;
  variant?: 'full' | 'icon' | 'badge';
  onClick?: () => void;
  appearance?: 'chip' | 'row';
  ariaLabel?: string;
  repoLabel?: string;
  branchLabel?: string;
  navigation?: 'internal' | 'external';
  hasReferenceActions?: boolean;
};

type ProviderMeta = {
  label: string;
  colorClasses: string;
};

const PROVIDER_META: Record<SessionExternalTaskProvider, ProviderMeta> = {
  linear: {
    label: 'Linear',
    colorClasses:
      'border-provider-linear/30 bg-provider-linear/5 text-provider-linear hover:border-provider-linear/60 hover:bg-provider-linear/10',
  },
  sentry: {
    label: 'Sentry',
    colorClasses:
      'border-provider-sentry/30 bg-provider-sentry/5 text-provider-sentry hover:border-provider-sentry/60 hover:bg-provider-sentry/10',
  },
  gitlab: {
    label: 'GitLab',
    colorClasses:
      'border-provider-gitlab/30 bg-provider-gitlab/5 text-provider-gitlab hover:border-provider-gitlab/60 hover:bg-provider-gitlab/10',
  },
  jira: {
    label: 'Jira',
    colorClasses:
      'border-provider-jira/30 bg-provider-jira/5 text-provider-jira hover:border-provider-jira/60 hover:bg-provider-jira/10',
  },
  github: {
    label: 'GitHub',
    colorClasses:
      'border-provider-github/30 bg-provider-github/5 text-provider-github hover:border-provider-github/60 hover:bg-provider-github/10',
  },
  bitbucket: {
    label: 'Bitbucket',
    colorClasses:
      'border-provider-bitbucket/30 bg-provider-bitbucket/5 text-provider-bitbucket hover:border-provider-bitbucket/60 hover:bg-provider-bitbucket/10',
  },
};

export const ExternalTaskChip = ({
  task,
  variant = 'full',
  onClick,
  appearance = 'chip',
  ariaLabel,
  repoLabel,
  branchLabel,
  navigation = 'external',
  hasReferenceActions = true,
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
    (() => {
      if (task.url === '') {
        return;
      }
      void openUrl(task.url);
    });

  if (appearance === 'row') {
    const attribution =
      repoLabel == null && branchLabel == null ? null : (
        <span className="flex min-w-0 items-center gap-1">
          {repoLabel != null ? <Chip tone="neutral" label={repoLabel} size="xs" /> : null}
          {branchLabel != null ? <Chip tone="neutral" label={branchLabel} size="xs" /> : null}
        </span>
      );
    return (
      <LinkedWorkRow
        leading={{ kind: 'glyph', provider: task.provider }}
        identifier={task.identifier}
        title={variant === 'full' ? task.title : undefined}
        onClick={handleClick}
        ariaLabel={ariaLabel ?? `open ${task.identifier} in ${meta.label}`}
        tooltip={tooltip}
        navigation={navigation}
        {...(attribution != null ? { attribution } : {})}
        actions={
          hasReferenceActions && task.url !== '' ? (
            <ExternalRefActions url={task.url} label={task.identifier} hostLabel={meta.label} />
          ) : undefined
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
      aria-label={ariaLabel ?? `open ${task.identifier} in ${meta.label}`}
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
