import { Check, ChevronDown } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { visibleCatalog } from '@goodboy/core';
import { AnchoredPopover, MenuItems, cn, useDropdown, type OverflowMenuItem } from '@goodboy/ui';
import {
  CHAT_PROVIDER_IDS,
  CHAT_PROVIDER_REFUSAL,
  isChatProvider,
  type ModelKey,
  type ProviderId,
} from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { useHiddenModels } from '../../../providers/hooks/useHiddenModels';
import { useAppStore } from '../../../../store';
import { chatModelLabel } from '../../chatModelLabel';
import type { ChatModelChoice } from '../../defaultChatModel';

type Props = {
  readonly provider: ProviderId;
  readonly model: ModelKey;
  readonly onPick: (choice: ChatModelChoice) => void;
};

const CHAT_MODEL_MENU_LABEL = 'Model for this chat';

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
  const offered = CHAT_PROVIDER_IDS.filter(
    (candidate) => candidate === provider || connected.includes(candidate),
  );
  const chatProviders = offered.length === 0 ? CHAT_PROVIDER_IDS : offered;
  const refused = connected.filter((candidate) => !isChatProvider(candidate));
  const modelItems: ReadonlyArray<OverflowMenuItem> = chatProviders.flatMap(
    (candidate): ReadonlyArray<OverflowMenuItem> => {
      const models = visibleCatalog({
        provider: candidate,
        hidden,
        currentKey: candidate === provider ? model : '',
      }).filter((entry) => entry.legacy !== true || entry.key === model);
      return [
        { kind: 'header', key: `header:${candidate}`, label: PROVIDER_LABEL[candidate] },
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
  const refusedItems: ReadonlyArray<OverflowMenuItem> =
    refused.length === 0
      ? []
      : [
          { kind: 'separator', key: 'refused-separator' },
          {
            kind: 'item',
            key: 'refused',
            label: refused.map((candidate) => PROVIDER_LABEL[candidate]).join(', '),
            description: CHAT_PROVIDER_REFUSAL,
            disabled: true,
            onClick: () => undefined,
          },
        ];
  const items = [...modelItems, ...refusedItems];

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
