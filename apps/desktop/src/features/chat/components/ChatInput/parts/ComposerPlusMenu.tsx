import { Paperclip, Plus } from '@goodboy/ui/icons';
import { AnchoredPopover, IconButton, useDropdown, type MenuEntry } from '@goodboy/ui';
import type { IconGlyph } from '@goodboy/ui/icons';
import type { QuickActionGroup } from '../../../../quick-actions/grammar';
import { AppMenuList } from '../../../../actions/AppMenuList';
import { CHAT_PREFIXES } from '../lib';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../../shared/utils/names';

type Props = {
  readonly onAttachFiles: () => void;
  readonly onInsertPrefix: (symbol: string) => void;
  readonly disabled?: boolean;
};

const GROUP_LABEL: Partial<Record<QuickActionGroup, string>> = {
  script: 'Run a script',
  workflow: NAMES.startRun,
  agent: NAMES.messageAnAgent,
};

const GROUP_ICON: Partial<Record<QuickActionGroup, IconGlyph>> = {
  script: CONCEPT_ICONS.scripts,
  workflow: CONCEPT_ICONS.runs,
  agent: CONCEPT_ICONS.agents,
};

export const ComposerPlusMenu = ({ onAttachFiles, onInsertPrefix, disabled = false }: Props) => {
  const dropdown = useDropdown({ disabled, align: 'start', width: 'w-60', expectedHeight: 220 });
  const entries: ReadonlyArray<MenuEntry> = [
    {
      kind: 'item',
      key: 'attach',
      label: 'Attach files',
      icon: Paperclip,
      onSelect: onAttachFiles,
    },
    ...CHAT_PREFIXES.map((prefix): MenuEntry => ({
      kind: 'item',
      key: prefix.symbol,
      label: GROUP_LABEL[prefix.group] ?? `Use ${prefix.noun}`,
      icon: GROUP_ICON[prefix.group] ?? CONCEPT_ICONS.runs,
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
          label={NAMES.addToMessage}
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
