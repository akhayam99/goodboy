import { Button } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openDestination } from '../../../shared/navigation/openDestination';
import { integrationLabel } from '../../../shared/utils/integrationLabel';
import { INBOX_PROVIDERS } from '../../inbox/types';
import { openConnections } from '../openConnections';
import { HOME_WIDGETS, type WidgetSize } from '../grid/homeWidgets';
import type { HomeFacts } from '../hooks/useHomeFacts';
import { tasksFactsOf } from '../reads/tasksFactsOf';
import { EmptyLine } from '../WidgetCard/EmptyLine';
import { FactRow } from '../WidgetCard/FactRow';
import { HeroNumber } from '../WidgetCard/HeroNumber';
import { WidgetCard } from '../WidgetCard';
import { WidgetSkeleton } from '../WidgetCard/WidgetSkeleton';

type Props = {
  readonly facts: HomeFacts;
  readonly size: WidgetSize;
};

const openTasks = (): void => openDestination({ id: 'inbox' });

export const TasksInbox = ({ facts, size }: Props) => {
  const newKeys = useAppStore((state) => state.taskNewKeys[facts.workspaceId] ?? EMPTY_ARRAY);
  const bindings = useAppStore(
    (state) => state.workspaceIntegrations[facts.workspaceId] ?? EMPTY_ARRAY,
  );
  const connected = INBOX_PROVIDERS.filter((provider) =>
    bindings.some((binding) => binding.provider === provider),
  );
  const tasks = tasksFactsOf({ newKeys, connected });
  return (
    <WidgetCard
      id="tasksInbox"
      title={HOME_WIDGETS.tasksInbox.title}
      icon={CONCEPT_ICONS.inbox}
      count={facts.isLoading ? 0 : tasks.newCount}
      tone="info"
      footer={
        size === 'M' && connected.length > 0 ? (
          <Button size="xs" variant="quiet" onClick={openTasks}>
            Open Tasks
          </Button>
        ) : undefined
      }
    >
      {facts.isLoading ? (
        <WidgetSkeleton label="Loading tasks" />
      ) : connected.length === 0 ? (
        <EmptyLine
          text="Connect a tracker to see its new issues."
          action={
            <Button size="xs" variant="quiet" onClick={openConnections}>
              Connect
            </Button>
          }
        />
      ) : size === 'S' ? (
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <HeroNumber value={String(tasks.newCount)} unit="new" />
        </div>
      ) : (
        <ul className="flex min-w-0 flex-1 flex-col">
          {tasks.sources.slice(0, 2).map((source) => (
            <FactRow
              key={source.provider}
              label={integrationLabel({ provider: source.provider })}
              value={`${source.newCount} new`}
            />
          ))}
        </ul>
      )}
    </WidgetCard>
  );
};
