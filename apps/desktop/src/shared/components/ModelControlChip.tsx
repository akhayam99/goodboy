import { AnchoredPopover, PopoverBody, useDropdown } from '@goodboy/ui';
import type { AgentEffort, ProviderId } from '@goodboy/types';
import { RoutingLabel } from './RoutingLabel';
import { RoutingPickerBody } from './RoutingPicker/RoutingPickerBody';
import type { RecommendationKind } from './RoutingPicker/RecommendationRow';
import { SUGGESTED_LABEL } from './RoutingPicker/autoRecommendationCopy';
import type { PickedRoute } from './RoutingPicker/PickedRoute';
import { recommendationSummary } from './RoutingPicker/recommendationSummary';
import { ControlChip } from './ControlChip';

type ModelRouting = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: AgentEffort;
};

type LastUsed = {
  readonly routing: ModelRouting;
  readonly isActive: boolean;
  readonly onSelect: () => void;
};

type Props = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly effective: ModelRouting;
  readonly suggestion: ModelRouting;
  readonly suggestionReason?: string;
  readonly suggestionLabel?: string | null;
  readonly ariaLabel?: string;
  readonly recommendationKind?: RecommendationKind;
  readonly lastUsed?: LastUsed | null;
  readonly isOverridden: boolean;
  readonly isDisabled?: boolean;
  readonly onChange: (route: PickedRoute | null) => void;
};

const MODEL_LABEL = 'Model';

export const ModelControlChip = ({
  connectedProviders,
  effective,
  suggestion,
  suggestionReason,
  suggestionLabel = SUGGESTED_LABEL,
  ariaLabel = MODEL_LABEL,
  recommendationKind,
  lastUsed = null,
  isOverridden,
  isDisabled = false,
  onChange,
}: Props) => {
  const dropdown = useDropdown({
    align: 'start',
    disabled: isDisabled,
    expectedWidth: 320,
    expectedHeight: 480,
  });
  const summary = recommendationSummary({
    provider: effective.provider,
    model: effective.model,
    effort: effective.effort,
  });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel={ariaLabel}
      className="w-80"
      trigger={
        <ControlChip
          label={MODEL_LABEL}
          value={summary}
          display={
            <RoutingLabel
              provider={effective.provider}
              model={effective.model}
              effort={effective.effort}
            />
          }
          suffix={isOverridden ? 'pinned' : null}
          isOpen={dropdown.open}
          isDisabled={isDisabled}
          onToggle={dropdown.toggle}
        />
      }
    >
      <PopoverBody>
        <RoutingPickerBody
          connectedProviders={connectedProviders}
          provider={effective.provider}
          model={effective.model}
          effort={{ editable: true, value: effective.effort }}
          onClose={dropdown.close}
          recommendation={{
            ...suggestion,
            ...(suggestionLabel !== null && { label: suggestionLabel }),
            ...(suggestionReason !== undefined && { reason: suggestionReason }),
          }}
          {...(recommendationKind !== undefined && { recommendationKind })}
          overridden={isOverridden}
          {...(lastUsed !== null && {
            lastUsed: {
              routing: lastUsed.routing,
              active: lastUsed.isActive,
              onSelect: lastUsed.onSelect,
            },
          })}
          onChange={(route) => onChange(route.provider === '' ? null : route)}
        />
      </PopoverBody>
    </AnchoredPopover>
  );
};
