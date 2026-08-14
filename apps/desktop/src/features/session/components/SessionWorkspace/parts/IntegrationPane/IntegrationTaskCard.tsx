import type { SessionExternalTask } from '@goodboy/types';
import { Chip, MetaRow } from '@goodboy/ui';
import { RailCard } from '@goodboy/ui';
import { formatRelativeAge } from '../../../../../../shared/utils/relativeDate';

type Props = {
  readonly task: SessionExternalTask;
  readonly providerLabel: string;
  readonly branch: string | null;
  readonly isCompleted: boolean;
  readonly onSelect: () => void;
};

export const IntegrationTaskCard = ({
  task,
  providerLabel,
  branch,
  isCompleted,
  onSelect,
}: Props) => (
  <RailCard
    title={task.title !== '' ? task.title : task.identifier}
    ariaLabel={`View ${task.identifier}`}
    muted={isCompleted}
    status={
      <>
        <Chip tone="neutral" label={branch ?? 'No branch'} size="xs" />
        {isCompleted && <Chip tone="merged" label="Completed" size="xs" />}
      </>
    }
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
