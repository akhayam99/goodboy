import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, Button, cn, type DropdownController } from '@goodboy/ui';
import { ICON_SIZE } from '../conceptIcons';
import type { SettingWords } from './settingWords';

type Props = {
  readonly dropdown: DropdownController;
  readonly label: string;
  readonly words: SettingWords;
  readonly help: string;
  readonly error: string | null;
  readonly children: ReactNode;
};

export const SettingChip = ({ dropdown, label, words, help, error, children }: Props) => (
  <AnchoredPopover
    dropdown={dropdown}
    role="dialog"
    ariaLabel={label}
    anchorClassName="inline-flex"
    className="flex flex-col gap-2 p-3"
    trigger={
      <Button
        size="xs"
        variant="secondary"
        aria-haspopup="dialog"
        aria-expanded={dropdown.open}
        aria-label={[`${label}: ${words.value}`, words.source]
          .filter((part) => part !== '')
          .join(', ')}
        data-setting-chip={label}
        onClick={dropdown.toggle}
        className={cn(dropdown.open && 'bg-selected')}
      >
        <span className="text-faint-foreground">{label}</span>
        <span className="text-foreground">{words.value}</span>
        {words.source === '' ? null : <span className="text-faint-foreground">{words.source}</span>}
        <ChevronDown size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
      </Button>
    }
  >
    <div className="flex min-w-0 items-baseline justify-between gap-2">
      <span className="text-row text-foreground">{label}</span>
      {words.source === '' ? null : (
        <span className="text-meta text-faint-foreground">{words.source}</span>
      )}
    </div>
    <p className="text-label text-muted-foreground">{help}</p>
    {children}
    {error === null ? null : (
      <p role="alert" className="text-label text-danger">
        {error}
      </p>
    )}
    <p data-setting-chain="" className="text-meta text-faint-foreground">
      {words.chain}
    </p>
  </AnchoredPopover>
);
