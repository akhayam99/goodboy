import { Check, ChevronDown } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { visibleCatalog } from '@goodboy/core';
import { AnchoredPopover, MenuItems, cn, useDropdown, type OverflowMenuItem } from '@goodboy/ui';
import { PROVIDER_IDS, type ModelKey, type ProviderId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { useHiddenModels } from '../../../providers/hooks/useHiddenModels';
import { useAppStore } from '../../../../store';
import { chatModelLabel } from '../../chatModelLabel';
import { CHAT_REFUSED_REASON, isChatProviderRefused } from '../../chatProviders';
import type { ChatModelChoice } from '../../defaultChatModel';

type Props = {
  readonly provider: ProviderId;
  readonly model: ModelKey;
  readonly onPick: (choice: ChatModelChoice) => void;
};

export const CHAT_MODEL_MENU_LABEL = 'Model for this chat';

export const ChatModelMenu = ({ provider, model, onPick }: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-64',
    expectedHeight: 360,
  });
  const hidden = useHiddenModels();
  const connected = useAppStore(
    useShallow((state) =>
      state.providers
        .filter((candidate) => candidate.connection === 'connected')
        .map((candidate) => candidate.id),
    ),
  );
  const shown = PROVIDER_IDS.filter(
    (candidate) => candidate === provider || connected.includes(candidate),
  );
  const items: ReadonlyArray<OverflowMenuItem> = shown.flatMap(
    (candidate): ReadonlyArray<OverflowMenuItem> => {
      const header: OverflowMenuItem = {
        kind: 'header',
        key: `header:${candidate}`,
        label: PROVIDER_LABEL[candidate],
      };
      if (isChatProviderRefused({ provider: candidate })) {
        return [
          header,
          {
            kind: 'item',
            key: `refused:${candidate}`,
            label: PROVIDER_LABEL[candidate],
            description: CHAT_REFUSED_REASON,
            disabled: true,
            onClick: () => undefined,
          },
        ];
      }
      const models = visibleCatalog({
        provider: candidate,
        hidden,
        currentKey: candidate === provider ? model : '',
      }).filter((entry) => entry.legacy !== true || entry.key === model);
      return [
        header,
        ...models.map((entry): OverflowMenuItem => ({
          kind: 'item',
          key: `${candidate}:${entry.key}`,
          label: entry.label,
          ...(candidate === provider && entry.key === model && { icon: Check, tone: 'primary' }),
          onClick: () => onPick({ provider: candidate, model: entry.key }),
        })),
      ];
    },
  );

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel={CHAT_MODEL_MENU_LABEL}
      className="max-h-96 py-1"
      trigger={
        <button
          type="button"
          onClick={dropdown.toggle}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
          aria-label={`${CHAT_MODEL_MENU_LABEL}: ${chatModelLabel({ provider, model })}`}
          className={cn(
            'flex h-6 items-center gap-1 rounded-md px-1.5 text-secondary text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            dropdown.open && 'bg-hover text-foreground',
          )}
        >
          <ProviderGlyph id={provider} size={ICON_SIZE.row} />
          {chatModelLabel({ provider, model })}
          <ChevronDown size={ICON_SIZE.row} aria-hidden className="text-faint-foreground" />
        </button>
      }
    >
      <MenuItems items={items} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
