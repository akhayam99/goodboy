import { ChevronDown, Plus } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import {
  AnchoredPopover,
  Button,
  MenuItems,
  Tooltip,
  useDropdown,
  type OverflowMenuItem,
} from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import type { NewDrawerForm } from '../../../../../store/slices/drawer/state';
import { selectOpenDrawer } from '../../../../../store/slices/drawer/selectOpenDrawer';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { useShortcut } from '../../../../../shared/keyboard/useShortcut';
import { useIsAutoOn } from '../../../../auto/useIsAutoOn';
import { NEW_DRAWER_FORMS } from '../../../newDrawerForms';
import { isSessionIdle } from '../../../isSessionIdle';

type Props = {
  readonly session: Session;
};

const MENU_FORMS: ReadonlyArray<NewDrawerForm> = [
  'run',
  'orchestrate',
  'agent',
  'auto',
  'report',
  'wireframe',
];

export const OverviewActions = ({ session }: Props) => {
  const sessionId = session.id;
  const isAutoOn = useIsAutoOn();
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

  const open = (form: NewDrawerForm): void => {
    const state = useAppStore.getState();
    if (form === 'report' || form === 'wireframe') {
      state.openArtifactCreation({ sessionId, kind: form, workflowRunId: null });
      return;
    }
    state.openDrawer({ kind: 'new', sessionId, payload: { form } });
  };

  const items: ReadonlyArray<OverflowMenuItem> = MENU_FORMS.filter(
    (form) => isAutoOn || !NEW_DRAWER_FORMS[form].isAutoOnly,
  ).map((form) => ({
    kind: 'item',
    key: form,
    label: NEW_DRAWER_FORMS[form].title,
    icon: NEW_DRAWER_FORMS[form].icon,
    onClick: () => open(form),
  }));

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="New"
      className="py-1"
      trigger={
        <Tooltip content="New" shortcut="overview.newHere" isSuppressed={dropdown.open}>
          <Button
            variant={isIdle ? 'primary' : 'secondary'}
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
      <MenuItems items={items} onClose={dropdown.close} />
    </AnchoredPopover>
  );
};
