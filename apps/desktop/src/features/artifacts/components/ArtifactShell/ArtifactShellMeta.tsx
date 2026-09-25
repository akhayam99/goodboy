import { MetaRow, cn } from '@goodboy/ui';
import type { Agent, PlanWithCount, SessionArtifact } from '@goodboy/types';
import { formatCompactDateTime } from '../../../../shared/utils/formatCompactDateTime';
import { planConsumerLabel, resolvePlanConsumer } from '../../../../shared/utils/planConsumer';
import { modelLabel } from '../../../chat/utils/chat-constants';

type Props = {
  readonly artifact: SessionArtifact;
  readonly plan: PlanWithCount | null;
  readonly agents: ReadonlyArray<Agent>;
  readonly onOpenAgent: (agent: Agent) => void;
  readonly onOpenDetails: () => void;
};

const LINK_CLASS =
  'min-w-0 truncate text-foreground underline decoration-border-soft underline-offset-3 hover:decoration-foreground';

export const ArtifactShellMeta = ({
  artifact,
  plan,
  agents,
  onOpenAgent,
  onOpenDetails,
}: Props) => {
  const creator = agents.find((agent) => agent.id === artifact.agentId) ?? null;
  const lastConsumer = plan?.lastConsumer ?? null;
  const consumer =
    plan === null || lastConsumer === null || plan.consumptionCount === 0
      ? null
      : resolvePlanConsumer({
          agentId: lastConsumer.agentId,
          agentName: lastConsumer.name,
          agents,
        });
  const model = creator?.modelOverride ?? null;

  return (
    <MetaRow
      items={[
        creator === null ? (
          <span key="creator">an agent that is gone</span>
        ) : (
          <button
            key="creator"
            type="button"
            className={LINK_CLASS}
            onClick={() => onOpenAgent(creator)}
            data-testid="artifact-creator"
          >
            {creator.name}
          </button>
        ),
        model === null ? null : <span key="model">{modelLabel(model)}</span>,
        <span key="revision">rev {artifact.revision}</span>,
        <span key="created" className="tabular-nums">
          {formatCompactDateTime({ iso: artifact.createdAt })}
        </span>,
        consumer === null || plan === null ? null : (
          <span key="consumer" className={cn(consumer.isDeleted && 'line-through')}>
            {planConsumerLabel({ name: consumer.name, count: plan.consumptionCount })}
          </span>
        ),
        <button
          key="sources"
          type="button"
          className={LINK_CLASS}
          onClick={onOpenDetails}
          data-testid="artifact-built-from-link"
        >
          where it came from
        </button>,
      ]}
    />
  );
};
