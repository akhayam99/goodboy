import type { ReactNode } from 'react';
import { AnchoredPopover, Button, Tooltip, cn, type DropdownController } from '@goodboy/ui';
import type { SettingWords } from './settingWords';

type Props = {
  readonly dropdown: DropdownController;
  readonly label: string;
  readonly words: SettingWords;
  readonly help: string;
  readonly error: string | null;
  readonly title?: string;
  readonly tooltip?: string;
  readonly children: ReactNode;
};

export const SettingChip = ({
  dropdown,
  label,
  words,
  help,
  error,
  title = label,
  tooltip,
  children,
}: Props) => {
  const trigger = (
    <Button
      size="xs"
      variant="setting"
      aria-haspopup="dialog"
      aria-expanded={dropdown.open}
      aria-label={[`${label}: ${words.value}`, words.source]
        .filter((part) => part !== '')
        .join(', ')}
      data-setting-chip={label}
      onClick={dropdown.toggle}
      className={cn('max-w-full', dropdown.open && 'border-border bg-selected')}
    >
      <span className="shrink-0 text-faint-foreground">{label}</span>
      <span className="min-w-0 max-w-56 truncate text-eyebrow text-foreground">{words.value}</span>
      {words.source === '' ? null : (
        <span className="shrink-0 text-faint-foreground">{words.source}</span>
      )}
    </Button>
  );
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={title}
      anchorClassName="inline-flex min-w-0"
      className="flex flex-col gap-2 p-3"
      trigger={
        tooltip === undefined ? (
          trigger
        ) : (
          <Tooltip content={tooltip} isSuppressed={dropdown.open}>
            {trigger}
          </Tooltip>
        )
      }
    >
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="text-row text-foreground">{title}</span>
        {words.source === '' ? null : (
          <span className="text-meta text-faint-foreground">{words.source}</span>
        )}
      </div>
      <p className="text-meta text-muted-foreground">{help}</p>
      {children}
      {error === null ? null : (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
      <p data-setting-chain="" className="text-meta text-faint-foreground">
        {words.chain}
      </p>
    </AnchoredPopover>
  );
};
