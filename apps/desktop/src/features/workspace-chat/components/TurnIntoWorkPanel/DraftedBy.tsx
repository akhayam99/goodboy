import { resolveStoredModelSelection } from '@goodboy/core';
import type { EffortLevel, ProviderId } from '@goodboy/types';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import { savedRouteEffort } from '../../../../shared/components/RoutingPicker/savedRouteEffort';
import type { WorkDrafterChoice } from '../../workDrafter';

type Props = {
  readonly choice: WorkDrafterChoice;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onChange: (choice: WorkDrafterChoice) => void;
};

const DRAFTED_BY_LABEL = 'Drafted by';
const DEFAULT_EFFORT: EffortLevel = 'medium';

export const DraftedBy = ({ choice, connectedProviders, onChange }: Props) => (
  <div className="flex min-w-0 items-center gap-2">
    <span className="text-meta text-muted-foreground">{DRAFTED_BY_LABEL}</span>
    <RoutingPicker
      ariaLabel={DRAFTED_BY_LABEL}
      variant="pill"
      align="start"
      availability="run"
      connectedProviders={connectedProviders}
      provider={choice.provider}
      model={choice.model}
      effort={{ editable: true, value: choice.effort ?? DEFAULT_EFFORT }}
      disabled={false}
      onChange={(route) => {
        if (route.provider === '') {
          return;
        }
        const effort = savedRouteEffort({
          route,
          requested: choice.effort ?? DEFAULT_EFFORT,
          wasSaved: choice.effort != null,
        });
        onChange({
          provider: route.provider,
          model: resolveStoredModelSelection({ provider: route.provider, id: route.model })
            .selection.key,
          ...(effort != null && { effort }),
        });
      }}
    />
  </div>
);
