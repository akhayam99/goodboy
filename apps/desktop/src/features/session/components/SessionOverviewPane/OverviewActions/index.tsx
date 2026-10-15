import { Plus } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Tooltip } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { selectOpenDrawer } from '../../../../../store/slices/drawer/selectOpenDrawer';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { useShortcut } from '../../../../../shared/keyboard/useShortcut';
import { isSessionIdle } from '../../../isSessionIdle';

type Props = {
  readonly session: Session;
};

export const OverviewActions = ({ session }: Props) => {
  const sessionId = session.id;
  const toggleDrawer = useAppStore((state) => state.toggleDrawer);
  const isOpen = useAppStore((state) => selectOpenDrawer(state)?.kind === 'new');
  const isAskOpen = useAppStore((state) => selectOpenDrawer(state)?.kind === 'ask');
  const isStudioOpen = useAppStore((state) => state.appStudio !== null);
  const agents = useAppStore(
    useShallow((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY),
  );
  const openQuestionCount = useAppStore(
    (state) =>
      (state.sessionOpenQuestions[sessionId] ?? EMPTY_ARRAY).filter(
        (question) => question.status === 'open',
      ).length,
  );
  const isIdle = isSessionIdle({
    agents,
    workflowRuns: session.workflowRuns,
    openQuestionCount,
  });
  const toggle = () => toggleDrawer({ kind: 'new', sessionId, payload: null });

  useShortcut('overview.newHere', toggle, !isAskOpen && !isStudioOpen);

  return (
    <Tooltip content="New" shortcut="overview.newHere">
      <Button
        variant={isIdle ? 'primary' : 'secondary'}
        size="sm"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Plus size={ICON_SIZE.control} aria-hidden className="shrink-0" />
        New
      </Button>
    </Tooltip>
  );
};
