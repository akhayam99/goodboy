import type { SessionExternalTask } from '@goodboy/types';
import { MetaRow } from '@goodboy/ui';
import { RailCard } from '../../../../../../shared/components/RailCard';
import { formatRelativeAge } from '../../../../../../shared/utils/relativeDate';

type Props = {
  readonly task: SessionExternalTask;
  readonly providerLabel: string;
  readonly onSelect: () => void;
};

export const IntegrationTaskCard = ({ task, providerLabel, onSelect }: Props) => (
  <RailCard
    title={task.title !== '' ? task.title : task.identifier}
    ariaLabel={`view ${task.identifier}`}
    meta={
      <MetaRow
        items={[
          <span key="identifier" className="font-mono">
            {task.identifier}
          </span>,
          <span key="provider">{providerLabel}</span>,
          <span key="linked">Linked {formatRelativeAge({ fromIso: task.createdAt })}</span>,
        ]}
      />
    }
    onSelect={onSelect}
  />
);
