import type { ProviderId } from '@goodboy/types';
import { ModelControlChip } from '../../../../shared/components/ModelControlChip';
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
    <ModelControlChip
      connectedProviders={connectedProviders}
      effective={active}
      suggestion={recommendation}
      suggestionLabel={null}
      isOverridden={routing !== null}
      isDisabled={isDisabled}
      onChange={(route) => {
        if (route === null || route.provider === '') {
          onChange(null);
          return;
        }
        onChange({ ...active, ...route, provider: route.provider });
      }}
    />
  );
};
