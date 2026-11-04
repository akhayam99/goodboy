import type { ReactNode } from 'react';
import {
  AnchoredPopover,
  Button,
  Tooltip,
  cn,
  tintClasses,
  type DropdownController,
} from '@goodboy/ui';
import type { SettingWords } from './settingWords';

const CHANGED_TINT = tintClasses('info');

type Props = {
  readonly dropdown: DropdownController;
  readonly label: string;
  readonly words: SettingWords;
  readonly help: string;
  readonly error: string | null;
  readonly title?: string;
  readonly tooltip?: string;
  readonly onChangeDefault?: () => void;
  readonly onOpenSource?: () => void;
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
  onChangeDefault,
  onOpenSource,
  children,
}: Props) => {
  const chip = (
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
      data-setting-changed={words.isChanged === true ? '' : undefined}
      className={cn(
        'max-w-full',
        words.isChanged === true && `${CHANGED_TINT.bgSoft} ${CHANGED_TINT.borderSoft}`,
        dropdown.open && 'border-border bg-selected',
      )}
    >
      <span className="shrink-0 text-faint-foreground">{label}:</span>
      <span className="min-w-0 max-w-56 truncate text-eyebrow text-foreground">{words.value}</span>
    </Button>
  );
  const trigger =
    words.spentText === undefined ? (
      chip
    ) : (
      <span className="inline-flex min-w-0 items-center gap-2">
        {chip}
        <span data-setting-spent="" className="shrink-0 text-meta text-faint-foreground">
          {words.spentText}
        </span>
      </span>
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
        <span className="flex shrink-0 items-baseline gap-2">
          {words.source === '' ? null : words.isFromWorkspace === true &&
            onOpenSource !== undefined ? (
            <Button variant="quiet" size="xs" onClick={onOpenSource}>
              {words.source}
            </Button>
          ) : (
            <span className="text-meta text-faint-foreground">{words.source}</span>
          )}
          {onChangeDefault === undefined ? null : (
            <Button variant="ghost" size="xs" onClick={onChangeDefault}>
              Change default
            </Button>
          )}
        </span>
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
