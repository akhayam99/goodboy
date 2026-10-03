import { GitBranch } from 'lucide-react';
import { Chip, type ChipSize } from '@goodboy/ui';
import type { SessionExternalTaskProvider } from '@goodboy/types';
import { IntegrationGlyph } from '../../../features/integrations/components/IntegrationGlyph';

type Props = {
  readonly provider: SessionExternalTaskProvider;
  readonly identifier: string;
  readonly title?: string;
  readonly isOnBranch?: boolean;
  readonly size?: ChipSize;
  readonly isActive?: boolean;
  readonly tooltip?: string;
  readonly ariaLabel?: string;
  readonly onClick?: () => void;
};

export const TaskLinkChip = ({
  provider,
  identifier,
  title,
  isOnBranch = false,
  size = 'control',
  isActive,
  tooltip,
  ariaLabel,
  onClick,
}: Props) => (
  <Chip
    as={onClick === undefined ? 'span' : 'button'}
    tone={isActive === true ? 'primary' : 'neutral'}
    shape="badge"
    size={size}
    {...(isActive === undefined ? {} : { ariaPressed: isActive })}
    {...(tooltip === undefined ? {} : { title: tooltip })}
    {...(ariaLabel === undefined ? {} : { ariaLabel })}
    {...(onClick === undefined ? {} : { onClick })}
    icon={
      isOnBranch ? (
        <span className="flex items-center gap-1">
          <IntegrationGlyph provider={provider} size="xs" />
          <GitBranch size={11} aria-label="Branch task" />
        </span>
      ) : (
        <IntegrationGlyph provider={provider} size="xs" />
      )
    }
    label={
      title === undefined ? (
        <span className="font-mono">{identifier}</span>
      ) : (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="font-mono">{identifier}</span>
          <span className="max-w-48 truncate text-muted-foreground">{title}</span>
        </span>
      )
    }
  />
);
