import { Plus } from 'lucide-react';
import { AnchoredPopover, IconButton, useDropdown } from '@goodboy/ui';
import type { QuickActionGroup } from '../../../../quick-actions/grammar';
import { CHAT_PREFIXES } from '../lib';

type Props = {
  readonly onAttachFiles: () => void;
  readonly onInsertPrefix: (symbol: string) => void;
  readonly disabled?: boolean;
};

const GROUP_LABEL: Partial<Record<QuickActionGroup, string>> = {
  script: 'Run a script',
  workflow: 'Start a workflow',
  agent: 'Ask another agent',
  skill: 'Run a skill',
};

export const ComposerPlusMenu = ({ onAttachFiles, onInsertPrefix, disabled = false }: Props) => {
  const dropdown = useDropdown({ disabled, align: 'start', width: 'w-60', expectedHeight: 200 });

  const menuItem = ({
    label,
    symbol,
    onClick,
  }: {
    readonly label: string;
    readonly symbol?: string;
    readonly onClick: () => void;
  }) => (
    <button
      key={label}
      type="button"
      role="menuitem"
      onClick={() => {
        dropdown.close();
        onClick();
      }}
      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-hover"
    >
      <span>{label}</span>
      {symbol != null && <span className="font-mono text-xs text-faint-foreground">{symbol}</span>}
    </button>
  );

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="Composer actions"
      className="w-60 p-1"
      trigger={
        <IconButton
          icon={Plus}
          label="More actions"
          variant="ghost"
          disabled={disabled}
          onClick={dropdown.toggle}
        />
      }
    >
      {menuItem({ label: 'Attach files', onClick: onAttachFiles })}
      {CHAT_PREFIXES.map((prefix) =>
        menuItem({
          label: GROUP_LABEL[prefix.group] ?? `Use ${prefix.noun}`,
          symbol: prefix.symbol,
          onClick: () => onInsertPrefix(prefix.symbol),
        }),
      )}
    </AnchoredPopover>
  );
};
