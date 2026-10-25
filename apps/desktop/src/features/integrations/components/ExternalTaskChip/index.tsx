import { Chip, cn, Tooltip } from '@goodboy/ui';
import type { SessionExternalTask, SessionExternalTaskProvider } from '@goodboy/types';
import { IntegrationGlyph } from '../IntegrationGlyph';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import { LinkedWorkRow } from '../LinkedWorkRow';
import { openUrl } from '../../../../shared/lib/editor';

type ExternalTaskChipTask = Pick<SessionExternalTask, 'provider' | 'identifier' | 'title' | 'url'>;

type Props = {
  task: ExternalTaskChipTask;
  variant?: 'full' | 'icon' | 'badge' | 'compact';
  identifierClassName?: string;
  onClick?: () => void;
  appearance?: 'chip' | 'row';
  ariaLabel?: string;
  repoLabel?: string;
  branchLabel?: string;
  navigation?: 'internal' | 'external';
  hasReferenceActions?: boolean;
};

const PROVIDER_LABEL: Record<SessionExternalTaskProvider, string> = {
  linear: 'Linear',
  sentry: 'Sentry',
  gitlab: 'GitLab',
  jira: 'Jira',
  github: 'GitHub',
  bitbucket: 'Bitbucket',
  slack: 'Slack',
};

const CHIP_CLASSES = 'border-border-soft bg-fill text-foreground hover:bg-overlay-hover';

export const ExternalTaskChip = ({
  task,
  variant = 'full',
  identifierClassName,
  onClick,
  appearance = 'chip',
  ariaLabel,
  repoLabel,
  branchLabel,
  navigation = 'external',
  hasReferenceActions = true,
}: Props) => {
  const providerLabel = PROVIDER_LABEL[task.provider];
  const tooltip = `${task.identifier}: ${task.title}`;

  const glyph = <IntegrationGlyph provider={task.provider} />;

  if (variant === 'icon') {
    return (
      <Tooltip content={tooltip}>
        <span
          aria-label={`${task.identifier} from ${providerLabel}`}
          className="inline-flex shrink-0 items-center"
        >
          {glyph}
        </span>
      </Tooltip>
    );
  }

  if (variant === 'compact') {
    return (
      <Tooltip content={tooltip}>
        <span className="inline-flex min-w-0 shrink-0 items-center gap-1 text-meta text-muted-foreground">
          <span aria-hidden className="inline-flex">
            {glyph}
          </span>
          <span aria-hidden className={cn('font-mono', identifierClassName)}>
            {task.identifier}
          </span>
          <span className="sr-only">{`${task.identifier} from ${providerLabel}`}</span>
        </span>
      </Tooltip>
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
          {repoLabel != null ? <Chip kind="state" tone="neutral" label={repoLabel} /> : null}
          {branchLabel != null ? <Chip kind="state" tone="neutral" label={branchLabel} /> : null}
        </span>
      );
    return (
      <LinkedWorkRow
        leading={{ kind: 'glyph', provider: task.provider }}
        identifier={task.identifier}
        title={variant === 'full' ? task.title : undefined}
        onClick={handleClick}
        ariaLabel={ariaLabel ?? `open ${task.identifier} in ${providerLabel}`}
        tooltip={tooltip}
        navigation={navigation}
        {...(attribution != null ? { attribution } : {})}
        actions={
          hasReferenceActions && task.url !== '' ? (
            <ExternalRefActions url={task.url} label={task.identifier} hostLabel={providerLabel} />
          ) : undefined
        }
      />
    );
  }

  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleClick();
        }}
        aria-label={ariaLabel ?? `open ${task.identifier} in ${providerLabel}`}
        className={cn(
          'inline-flex min-w-0 shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-chip transition-colors',
          CHIP_CLASSES,
        )}
      >
        {glyph}
        <span className="shrink-0 font-mono">{task.identifier}</span>
        {variant === 'full' ? <span className="truncate">{task.title}</span> : null}
      </button>
    </Tooltip>
  );
};
