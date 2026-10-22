import { ChevronDown, Plus } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { AnchoredPopover, Button, Tooltip, useDropdown } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { selectOpenDrawer } from '../../../../../store/slices/drawer/selectOpenDrawer';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { useShortcut } from '../../../../../shared/keyboard/useShortcut';
import { NewFormMenuList } from '../../../../actions/NewFormMenuList';
import { isSessionIdle } from '../../../isSessionIdle';

type Props = {
  readonly session: Session;
  readonly hasNextLead?: boolean;
};

export const OverviewActions = ({ session, hasNextLead = false }: Props) => {
  const sessionId = session.id;
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
  const dropdown = useDropdown({ align: 'end', width: 'min-w-50', expectedHeight: 220 });

  useShortcut('overview.newHere', dropdown.toggle, !isAskOpen && !isStudioOpen);

  return (
    <AnchoredPopover
      dropdown={dropdown}
      trigger={
        <Tooltip content="New" shortcut="overview.newHere" isSuppressed={dropdown.open}>
          <Button
            variant={isIdle && !hasNextLead ? 'primary' : 'secondary'}
            size="sm"
            onClick={dropdown.toggle}
            aria-haspopup="menu"
            aria-expanded={dropdown.open}
          >
            <Plus size={ICON_SIZE.control} aria-hidden className="shrink-0" />
            New
            <ChevronDown size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          </Button>
        </Tooltip>
      }
    >
      <NewFormMenuList facts={{ sessionId }} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
