import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, ICON_SIZE, PopoverBody, useDropdown } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import type { AgentKindRouting } from '../../../session/agent-kind';
import { RoutingPickerBody } from '../../../../shared/components/RoutingPicker/RoutingPickerBody';
import { SUGGESTED_LABEL } from '../../../../shared/components/RoutingPicker/autoRecommendationCopy';
import {
  routingLabelParts,
  routingNameText,
} from '../../../../shared/components/RoutingPicker/routingSummary';

type Props = {
  readonly suggested: AgentKindRouting;
  readonly routing: AgentKindRouting;
  readonly isOverridden: boolean;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly isDisabled: boolean;
  readonly onChange: (next: AgentKindRouting | null) => void;
};

export const ModelChipPicker = ({
  suggested,
  routing,
  isOverridden,
  connectedProviders,
  isDisabled,
  onChange,
}: Props) => {
  const dropdown = useDropdown({
    expectedHeight: 420,
    expectedWidth: 360,
    width: 'w-[22.5rem] max-w-[calc(100vw-2rem)]',
    disabled: isDisabled,
  });
  const name = routingNameText(routingLabelParts(routing));
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={`Model ${name}`}
      className="flex max-h-[calc(100vh-1rem)] flex-col bg-subtle"
      anchorClassName="flex shrink-0"
      trigger={
        <button
          type="button"
          onClick={dropdown.toggle}
          disabled={isDisabled}
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          aria-label={`Model ${name}`}
          className="inline-flex items-center gap-0.5 rounded-md bg-subtle px-2 py-0.5 text-meta text-foreground transition-colors hover:bg-hover disabled:opacity-60"
        >
          {name}
          <ChevronDown size={ICON_SIZE.row} aria-hidden className="text-muted-foreground" />
        </button>
      }
    >
      <PopoverBody>
        <RoutingPickerBody
          connectedProviders={connectedProviders}
          onClose={dropdown.close}
          recommendation={{ ...suggested, label: SUGGESTED_LABEL }}
          overridden={isOverridden}
          onReset={() => onChange(null)}
          provider={routing.provider}
          model={routing.model}
          effort={{ editable: true, value: routing.effort }}
          onChange={(route) => {
            if (route.provider === '') {
              onChange(null);
              return;
            }
            onChange({ provider: route.provider, model: route.model, effort: route.effort });
          }}
        />
      </PopoverBody>
    </AnchoredPopover>
  );
};
