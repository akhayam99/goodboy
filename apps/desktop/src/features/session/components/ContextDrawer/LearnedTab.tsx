import { EmptyLine } from '@goodboy/ui';
import type { SessionContextItem } from '@goodboy/types';
import { useNow } from '../../../../shared/hooks/useNow';
import { LearningRow } from '../../../../shared/components/Learnings/LearningRow';
import type { LearningList } from '../../../../shared/hooks/useLearningList';

type Props = {
  readonly list: LearningList;
};

export const LearnedTab = ({ list }: Props) => {
  const now = useNow(60_000);
  if (list.visible.length === 0) {
    return (
      <EmptyLine className="text-body text-muted-foreground">
        Nothing learned in this session yet.
      </EmptyLine>
    );
  }
  return (
    <div className="-mx-2 flex flex-col gap-0.5">
      {list.visible.map((item: SessionContextItem) => (
        <LearningRow
          key={item.id}
          item={item}
          placement="drawer"
          isOpen={list.openId === item.id}
          now={now}
          onToggle={() => list.toggle(item.id)}
          onDismiss={() => list.dismiss(item.id)}
          onUndo={() => list.undo(item.id)}
        />
      ))}
    </div>
  );
};
