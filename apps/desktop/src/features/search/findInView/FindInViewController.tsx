import { useAppStore } from '../../../store';
import { useShortcut } from '../../../shared/keyboard/useShortcut';
import { FindSession } from './FindSession';

export const FindInViewController = () => {
  const viewFind = useAppStore((state) => state.viewFind);
  const stepViewFind = useAppStore((state) => state.stepViewFind);

  useShortcut('find.next', () => stepViewFind({ delta: 1 }));
  useShortcut('find.previous', () => stepViewFind({ delta: -1 }));

  if (viewFind === null) {
    return null;
  }
  return <FindSession key={viewFind.startedAt} viewFind={viewFind} />;
};
