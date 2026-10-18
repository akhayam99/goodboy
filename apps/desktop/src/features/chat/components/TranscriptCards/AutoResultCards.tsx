import type { AgentId } from '@goodboy/types';
import type { AutoDeliveredResult } from '../../../../store/slices/auto-view/state';
import { AutoResultCard } from './AutoResultCard';

type Props = {
  readonly results: ReadonlyArray<AutoDeliveredResult>;
  readonly labels: ReadonlyMap<AgentId, string>;
  readonly onOpenChild: (agentId: AgentId) => void;
};

export const AutoResultCards = ({ results, labels, onOpenChild }: Props) => (
  <ul aria-label="What the agents reported" className="flex min-w-0 flex-col gap-2">
    {results.map((result) => (
      <li key={`${result.runId}-${result.delegationId}`}>
        <AutoResultCard
          result={result}
          label={labels.get(result.childAgentId) ?? 'Agent'}
          onOpenChild={onOpenChild}
        />
      </li>
    ))}
  </ul>
);
