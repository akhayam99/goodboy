import type { ReactNode } from 'react';
import { Button, StatusDot, cn } from '@goodboy/ui';
import {
  IntegrationGlyph,
  integrationLabel,
  type IntegrationGlyphProvider,
} from '../../../integrations/components/IntegrationGlyph';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly provider: IntegrationGlyphProvider;
  readonly label?: string;
  readonly line: string;
  readonly isReady: boolean;
  readonly isExpanded: boolean;
  readonly onExpandedChange: (next: boolean) => void;
  readonly blockedAction?: ReactNode;
  readonly children?: ReactNode;
};

export const IntegrationChoiceRow = ({
  provider,
  label,
  line,
  isReady,
  isExpanded,
  onExpandedChange,
  blockedAction,
  children,
}: Props) => {
  const name = label ?? integrationLabel({ provider });
  const isBlocked = blockedAction !== undefined;
  return (
    <li
      data-provider={provider}
      className="flex flex-col rounded-lg border border-border-soft bg-subtle"
    >
      <div className="flex items-center gap-3 px-3.5 py-3">
        <span className={cn('shrink-0', isBlocked && 'opacity-50')}>
          <IntegrationGlyph provider={provider} size={ICON_SIZE.hero} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn('text-row', isBlocked ? 'text-muted-foreground' : 'text-foreground')}>
            {name}
          </span>
          <span className="text-secondary text-muted-foreground">{line}</span>
        </div>
        {isReady && (
          <span className="flex shrink-0 items-center gap-1.5 text-label text-foreground">
            <StatusDot tone="success" size="sm" />
            Ready
          </span>
        )}
        {!isReady && isBlocked && blockedAction}
        {!isReady && !isBlocked && children !== undefined && (
          <Button
            size="sm"
            variant={isExpanded ? 'ghost' : 'secondary'}
            aria-label={isExpanded ? `Close ${name}` : `Connect ${name}`}
            aria-expanded={isExpanded}
            onClick={() => onExpandedChange(!isExpanded)}
          >
            {isExpanded ? 'Close' : 'Connect'}
          </Button>
        )}
      </div>
      {isExpanded && !isReady && children !== undefined && (
        <div className="px-3.5 pb-3">{children}</div>
      )}
    </li>
  );
};
