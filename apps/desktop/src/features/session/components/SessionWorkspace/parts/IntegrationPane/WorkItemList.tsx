import type { WorkItem } from '../../../../workItems';
import { IntegrationTaskCard } from './IntegrationTaskCard';
import { integrationTaskKey } from './integrationTaskKey';

type Props = {
  readonly items: ReadonlyArray<WorkItem>;
  readonly providerLabel: string;
  readonly onSelect: (taskKey: string) => void;
};

export const WorkItemList = ({ items, providerLabel, onSelect }: Props) => {
  if (items.length === 0) {
    return null;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.key}>
          <IntegrationTaskCard
            task={item.task}
            providerLabel={providerLabel}
            branch={item.branch}
            isCompleted={item.isCompleted}
            onSelect={() => onSelect(integrationTaskKey({ task: item.task }))}
          />
        </li>
      ))}
    </ul>
  );
};
