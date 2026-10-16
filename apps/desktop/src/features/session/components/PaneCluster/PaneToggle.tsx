import type { LucideIcon } from 'lucide-react';
import { Button, Tooltip, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { ShortcutId } from '../../../../shared/keyboard/registry';

type Props = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tooltip: string;
  readonly shortcut?: ShortcutId;
  readonly isOpen: boolean;
  readonly isDisabled?: boolean;
  readonly testId: string;
  readonly onToggle: () => void;
};

export const PaneToggle = ({
  icon: Icon,
  label,
  tooltip,
  shortcut,
  isOpen,
  isDisabled = false,
  testId,
  onToggle,
}: Props) => (
  <Tooltip content={tooltip} {...(shortcut !== undefined && { shortcut })}>
    <Button
      variant="quiet"
      size="xs"
      data-testid={testId}
      aria-pressed={isOpen}
      aria-disabled={isDisabled ? true : undefined}
      onClick={() => {
        if (isDisabled) {
          return;
        }
        onToggle();
      }}
      className={cn(
        isOpen && 'bg-selected text-foreground',
        isDisabled &&
          'text-disabled-foreground hover:bg-transparent hover:text-disabled-foreground',
      )}
    >
      <Icon size={ICON_SIZE.row} aria-hidden />
      {label}
    </Button>
  </Tooltip>
);
