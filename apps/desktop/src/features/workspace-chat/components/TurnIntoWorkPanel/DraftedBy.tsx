import { clampEffortForModel, resolveStoredModelSelection } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import type { WorkDrafterChoice } from '../../workDrafter';

type Props = {
  readonly choice: WorkDrafterChoice;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onChange: (update: (current: WorkDrafterChoice) => WorkDrafterChoice) => void;
};

const DRAFTED_BY_LABEL = 'Drafted by';

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
      effort={{
        editable: true,
        value: choice.effort ?? 'medium',
        onChange: (effort) => onChange((current) => ({ ...current, effort })),
      }}
      disabled={false}
      onProvider={(provider) => {
        if (provider === '') {
          return;
        }
        onChange((current) => ({ ...current, provider }));
      }}
      onModel={(model) =>
        onChange((current) => {
          const key = resolveStoredModelSelection({ provider: current.provider, id: model })
            .selection.key;
          const effort =
            current.effort == null
              ? null
              : clampEffortForModel({
                  model: key,
                  effort: current.effort,
                  provider: current.provider,
                });
          return {
            provider: current.provider,
            model: key,
            ...(effort != null && { effort }),
          };
        })
      }
    />
  </div>
);
