import type { ProviderId, EffortLevel } from '@goodboy/types';
import { RoutingPicker } from '../../../../shared/components/RoutingPicker';
import type { ArtifactCreationRouting } from '../../../../store/slices/artifactDrafts/types';

type Props = {
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly recommendation: ArtifactCreationRouting;
  readonly routing: ArtifactCreationRouting | null;
  readonly isDisabled: boolean;
  readonly onChange: (routing: ArtifactCreationRouting | null) => void;
};

export const ArtifactRoutingControl = ({
  connectedProviders,
  recommendation,
  routing,
  isDisabled,
  onChange,
}: Props) => {
  const active = routing ?? recommendation;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-secondary text-muted-foreground">Runs on</span>
      <RoutingPicker
        ariaLabel="Artifact routing"
        variant="pill"
        align="start"
        availability="run"
        connectedProviders={connectedProviders}
        provider={active.provider}
        model={active.model}
        effort={{
          editable: true,
          value: active.effort,
          onChange: (effort: EffortLevel) => onChange({ ...active, effort }),
        }}
        recommendation={{ provider: recommendation.provider, model: recommendation.model }}
        disabled={isDisabled}
        overridden={routing !== null}
        resetLabel="Use default"
        onReset={() => onChange(null)}
        onProvider={(provider) => {
          if (provider === '') {
            onChange(null);
            return;
          }
          onChange({ ...active, provider });
        }}
        onModel={(model) => onChange({ ...active, model })}
      />
    </div>
  );
};
