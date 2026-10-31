import { FactCard, StatusDot } from '@goodboy/ui';

import { artifactStateCardOf } from '../../artifactStateCardOf';
import type { ArtifactState } from '../../artifactStateOf';

type Props = {
  readonly state: ArtifactState;
};

export const ArtifactStateBadge = ({ state }: Props) => (
  <FactCard card={artifactStateCardOf({ state })}>
    <span
      data-testid="artifact-row-state"
      data-state={state.key}
      className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap text-meta text-muted-foreground"
    >
      <StatusDot size="sm" tone={state.tone} />
      <span className="truncate">{state.label}</span>
    </span>
  </FactCard>
);
