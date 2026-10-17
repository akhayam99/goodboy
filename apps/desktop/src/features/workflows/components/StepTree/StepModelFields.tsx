import { SegmentedTabs } from '@goodboy/ui';
import type { EffortLevel, ProviderId } from '@goodboy/types';
import type { StepDraft } from '../../engine';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import type { PickedRoute } from '../../../../shared/components/RoutingPicker/PickedRoute';
import {
  routingLabelParts,
  routingNameText,
} from '../../../../shared/components/RoutingPicker/routingSummary';
import { ROLE_LABEL } from '../../../session/agent-kind';

type ModelSource = 'follow' | 'pin';

type Props = {
  readonly step: StepDraft;
  readonly routingLabel: string;
  readonly effort: EffortLevel;
  readonly recommendedProvider: ProviderId;
  readonly recommendedModel: string;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly isRoutingOverridden: boolean;
  readonly roleSetLine?: string | null;
  readonly isDisabled: boolean;
  readonly onRoute: (route: PickedRoute) => void;
  readonly onRoutingReset: () => void;
  readonly onPin: () => void;
};

const MODEL_SOURCES = [
  { value: 'follow', label: 'Follow role' },
  { value: 'pin', label: 'Pin a model' },
] as const satisfies ReadonlyArray<{ readonly value: ModelSource; readonly label: string }>;

export const StepModelFields = ({
  step,
  routingLabel,
  effort,
  recommendedProvider,
  recommendedModel,
  connectedProviders,
  isRoutingOverridden,
  roleSetLine = null,
  isDisabled,
  onRoute,
  onRoutingReset,
  onPin,
}: Props) => {
  const source: ModelSource = isRoutingOverridden ? 'pin' : 'follow';
  const followLabel = routingLabelParts({
    provider: recommendedProvider,
    model: recommendedModel,
    effort,
  });
  const followPick = [routingNameText(followLabel), ...followLabel.detail].join(' · ');

  return (
    <>
      <div className="px-3">
        <SegmentedTabs
          ariaLabel="Model source"
          size="sm"
          fill
          options={MODEL_SOURCES}
          value={source}
          onChange={(next) => {
            if (isDisabled || next === source) {
              return;
            }
            if (next === 'follow') {
              onRoutingReset();
              return;
            }
            onPin();
          }}
        />
      </div>
      {source === 'follow' && roleSetLine !== null ? (
        <p data-testid="step-follows-role" className="px-3 text-meta text-muted-foreground">
          {`Follows the role: ${roleSetLine}`}
        </p>
      ) : null}
      {source === 'follow' && roleSetLine === null ? (
        <p data-testid="step-follows-role" className="px-3 text-meta text-muted-foreground">
          {`Follows the ${ROLE_LABEL[step.role]} role. Auto picks `}
          <span className="text-foreground">{followPick}</span>
          {' from the providers you can use now.'}
        </p>
      ) : null}
      {source === 'follow' ? null : (
        <RoutingPicker
          presentation="inline"
          ariaLabel={routingLabel}
          connectedProviders={connectedProviders}
          provider={step.provider}
          model={step.model}
          effort={{ editable: true, value: effort }}
          disabled={isDisabled}
          overridden
          onChange={onRoute}
        />
      )}
    </>
  );
};
