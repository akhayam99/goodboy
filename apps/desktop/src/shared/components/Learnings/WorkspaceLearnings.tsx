import { useEffect, useId, useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { ICON_SIZE, Reveal } from '@goodboy/ui';
import type { SessionContextItem, WorkspaceId } from '@goodboy/types';
import { sessionPlace, useAppStore } from '../../../store';
import { useNow } from '../../hooks/useNow';
import { useLearningList } from '../../hooks/useLearningList';
import { groupLearningsByTopic } from './learningCopy';
import { LearningRow } from './LearningRow';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly topics: ReadonlyArray<string>;
};

const EMPTY: ReadonlyArray<SessionContextItem> = [];

export const WorkspaceLearnings = ({ workspaceId, topics }: Props) => {
  const items = useAppStore((state) => state.workspaceLearnings[workspaceId] ?? EMPTY);
  const loadWorkspaceLearnings = useAppStore((state) => state.loadWorkspaceLearnings);
  const navigate = useAppStore((state) => state.navigate);
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();
  const now = useNow(60_000, isOpen);
  const list = useLearningList({ items });
  const groups = useMemo(
    () => groupLearningsByTopic({ items: list.visible, topics }),
    [list.visible, topics],
  );

  const openSession = ({ item }: { readonly item: SessionContextItem }) => {
    if (item.sessionId !== null) {
      navigate({ to: sessionPlace({ sessionId: item.sessionId }) });
    }
  };

  useEffect(() => {
    void loadWorkspaceLearnings({ workspaceId });
  }, [loadWorkspaceLearnings, workspaceId]);

  if (list.visible.length === 0 && topics.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col">
      <div className="flex h-7 items-center gap-1.5 px-0.5 text-label text-faint-foreground">
        <BookOpen size={ICON_SIZE.control} aria-hidden className="text-muted-foreground" />
        <span className="text-muted-foreground">Learned</span>
        <span aria-hidden>·</span>
        <span className="tabular-nums text-foreground">{list.activeCount}</span>
        {list.visible.length > 0 ? (
          <>
            <span aria-hidden>·</span>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={listId}
              onClick={() => setIsOpen(!isOpen)}
              className="rounded-sm text-primary hover:underline"
            >
              {isOpen ? 'Hide' : 'Open'}
            </button>
          </>
        ) : null}
      </div>
      <Reveal open={isOpen} id={listId}>
        <div className="flex flex-col gap-1 pt-1">
          {groups.map((group) => (
            <section key={group.topic} aria-label={group.topic} className="flex flex-col">
              <h3 className="flex items-center gap-2 px-2 pb-1 pt-1.5 text-heading text-foreground">
                {group.topic}
                <span className="text-meta text-faint-foreground">
                  {group.items.filter((item) => item.status === 'active').length}
                </span>
              </h3>
              {group.items.map((item) => (
                <LearningRow
                  key={item.id}
                  item={item}
                  placement="workspace"
                  isOpen={list.openId === item.id}
                  now={now}
                  onToggle={() => list.toggle(item.id)}
                  onDismiss={() => list.dismiss(item.id)}
                  onUndo={() => list.undo(item.id)}
                  onOpenSession={() => openSession({ item })}
                />
              ))}
            </section>
          ))}
        </div>
      </Reveal>
    </div>
  );
};
