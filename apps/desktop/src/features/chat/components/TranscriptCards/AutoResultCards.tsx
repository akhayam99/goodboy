import type { AgentId } from '@goodboy/types';
import type { AutoDeliveredResult } from '../../../../store/slices/auto-view/state';
import type { ArtifactLinkModel } from '../../../auto/chat/artifactLinksOf';
import { AutoResultCard } from './AutoResultCard';

type Props = {
  readonly results: ReadonlyArray<AutoDeliveredResult>;
  readonly labels: ReadonlyMap<AgentId, string>;
  readonly artifacts: ReadonlyMap<string, ReadonlyArray<ArtifactLinkModel>>;
  readonly onOpenChild: (agentId: AgentId) => void;
  readonly onOpenArtifact: (artifactId: string) => void;
};

const NO_LINKS: ReadonlyArray<ArtifactLinkModel> = [];

export const AutoResultCards = ({
  results,
  labels,
  artifacts,
  onOpenChild,
  onOpenArtifact,
}: Props) => (
  <ul aria-label="What the agents reported" className="flex min-w-0 flex-col gap-2">
    {results.map((result) => (
      <li key={`${result.runId}-${result.delegationId}`}>
        <AutoResultCard
          result={result}
          label={labels.get(result.childAgentId) ?? 'Agent'}
          artifacts={artifacts.get(result.delegationId) ?? NO_LINKS}
          onOpenChild={onOpenChild}
          onOpenArtifact={onOpenArtifact}
        />
      </li>
    ))}
  </ul>
);
