import type { ReactNode } from 'react';
import { Button } from '@goodboy/ui';
import {
  IntegrationGlyph,
  integrationLabel,
  type IntegrationGlyphProvider,
} from '../../../integrations/components/IntegrationGlyph';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { StepListRow } from './StepListRow';
import { StepStatus } from './StepStatus';

type Props = {
  readonly provider: IntegrationGlyphProvider;
  readonly label?: string;
  readonly line: string;
  readonly isReady: boolean;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly form?: ReactNode;
};

export const ToolRow = ({ provider, label, line, isReady, isOpen, onToggle, form }: Props) => {
  const name = label ?? integrationLabel({ provider });
  const hasForm = form !== undefined && !isReady;
  return (
    <StepListRow
      rowId={provider}
      icon={<IntegrationGlyph provider={provider} size={ICON_SIZE.hero} />}
      name={name}
      line={line}
      trailing={
        isReady ? (
          <StepStatus tone="success" label="Ready" />
        ) : hasForm ? (
          <Button
            size="sm"
            variant={isOpen ? 'quiet' : 'secondary'}
            aria-expanded={isOpen}
            aria-label={isOpen ? `Close ${name}` : `Connect ${name}`}
            onClick={onToggle}
          >
            {isOpen ? 'Close' : 'Connect'}
          </Button>
        ) : null
      }
      isPanelOpen={hasForm && isOpen}
      panel={hasForm ? <div className="rounded-md bg-background p-3">{form}</div> : null}
    />
  );
};
