import { Plus } from 'lucide-react';
import { AnchoredPopover, IconButton, useDropdown, type MenuEntry } from '@goodboy/ui';
import type { QuickActionGroup } from '../../../../quick-actions/grammar';
import { AppMenuList } from '../../../../actions/AppMenuList';
import { CHAT_PREFIXES } from '../lib';
import { NAMES } from '../../../../../shared/utils/names';

type Props = {
  readonly onAttachFiles: () => void;
  readonly onInsertPrefix: (symbol: string) => void;
  readonly disabled?: boolean;
};

const GROUP_LABEL: Partial<Record<QuickActionGroup, string>> = {
  script: 'Run a script',
  workflow: NAMES.startRun,
  agent: 'Ask another agent',
};

export const ComposerPlusMenu = ({ onAttachFiles, onInsertPrefix, disabled = false }: Props) => {
  const dropdown = useDropdown({ disabled, align: 'start', width: 'w-60', expectedHeight: 220 });
  const entries: ReadonlyArray<MenuEntry> = [
    { kind: 'item', key: 'attach', label: 'Attach files', onSelect: onAttachFiles },
    ...CHAT_PREFIXES.map((prefix): MenuEntry => ({
      kind: 'item',
      key: prefix.symbol,
      label: GROUP_LABEL[prefix.group] ?? `Use ${prefix.noun}`,
      hint: prefix.symbol,
      onSelect: () => onInsertPrefix(prefix.symbol),
    })),
  ];

  return (
    <AnchoredPopover
      dropdown={dropdown}
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
      <AppMenuList label="Composer actions" entries={entries} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
