import { TriangleAlert } from 'lucide-react';
import type { CliGate } from '@goodboy/core';
import { cn, FOCUS_RING, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { CLI_LABEL } from '../cliLabel';

type Props = {
  readonly gate: CliGate;
  readonly onUpdate?: () => void;
  readonly className?: string;
};

export const CliGateLine = ({ gate, onUpdate, className }: Props) => (
  <p
    role="status"
    aria-label="CLI update needed"
    className={cn('flex items-start gap-1.5 text-2xs text-muted-foreground', className)}
  >
    <TriangleAlert
      size={ICON_SIZE.row}
      aria-hidden
      className={cn('mt-px shrink-0', tintClasses('warning').icon)}
    />
    <span className="min-w-0">
      {`${gate.model.label} needs ${CLI_LABEL[gate.provider]} ${gate.requiredVersion} or newer. You have ${gate.installedVersion}.`}
    </span>
    {onUpdate !== undefined && (
      <button
        type="button"
        onClick={onUpdate}
        className={cn(
          'shrink-0 rounded-sm text-foreground underline underline-offset-2 hover:text-muted-foreground',
          FOCUS_RING,
        )}
      >
        Update
      </button>
    )}
  </p>
);
