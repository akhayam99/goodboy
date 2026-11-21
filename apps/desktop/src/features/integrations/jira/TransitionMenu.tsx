import { useState } from 'react';
import { ChevronDown } from '@goodboy/ui/icons';
import {
  AnchoredPopover,
  cn,
  ICON_SIZE,
  tintClasses,
  Tooltip,
  type MenuEntry,
  type StateTone,
  useDropdown,
} from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { hostErrorRecoveryOf } from '../../../store/slices/notifications/hostErrorRecovery';
import { useJiraTransitions } from './useJiraTransitions';

import { AppMenuList } from '../../actions/AppMenuList';

type CurrentState = {
  readonly label: string;
  readonly tone: StateTone;
};

type Props = {
  readonly issueKey: string;
  readonly workspaceId: WorkspaceId;
  readonly onTransition: (transitionId: string) => Promise<void>;
  readonly state: CurrentState;
};

type MoveParams = {
  readonly transitionId: string;
  readonly name: string;
};

type ReasonParams = {
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly count: number;
};

const SCREEN_HINT = 'Jira asks for extra fields on this move. Goodboy sends it without them.';

const blockReason = ({ isLoading, error, count }: ReasonParams): string | null => {
  if (isLoading) {
    return 'Reading the Jira workflow for this issue';
  }
  if (error != null) {
    return `Couldn't read the Jira workflow for this issue. ${error}`;
  }
  if (count === 0) {
    return 'Jira offers no move from this status';
  }
  return null;
};

type DescribeParams = {
  readonly to: string | null;
  readonly hasScreen: boolean;
};

const describeMove = ({ to, hasScreen }: DescribeParams): string | null => {
  if (!hasScreen) {
    return to;
  }
  if (to === null) {
    return SCREEN_HINT;
  }
  return `${to}. ${SCREEN_HINT}`;
};

export const TransitionMenu = ({ issueKey, workspaceId, onTransition, state }: Props) => {
  const { transitions, isLoading, error, reload } = useJiraTransitions({ issueKey, workspaceId });
  const [busyId, setBusyId] = useState<string | null>(null);
  const reportError = useAppStore((state) => state.reportError);
  const reason = blockReason({ isLoading, error, count: transitions.length });
  const isBlocked = reason != null;
  const dropdown = useDropdown({
    disabled: isBlocked,
    width: 'w-60',
    expectedHeight: 280,
  });
  const { open: isOpen, close, toggle } = dropdown;

  const move = async ({ transitionId, name }: MoveParams): Promise<boolean> => {
    setBusyId(transitionId);
    try {
      await onTransition(transitionId);
      reload();
      return true;
    } catch (error: unknown) {
      void reportError({
        title: `Couldn't move ${issueKey} to ${name}`,
        error,
        workspaceId,
        recovery: hostErrorRecoveryOf({ error, tool: 'jira' }),
        retry: () => move({ transitionId, name }),
      });
      return false;
    } finally {
      close();
      setBusyId(null);
    }
  };

  const entries: ReadonlyArray<MenuEntry> = transitions.map((transition) => ({
    kind: 'item',
    key: transition.id,
    label: transition.name,
    description: describeMove({ to: transition.to?.name ?? null, hasScreen: transition.hasScreen }),
    isDisabled: busyId != null,
    shouldStayOpen: true,
    onSelect: () => void move({ transitionId: transition.id, name: transition.name }),
  }));

  return (
    <AnchoredPopover
      dropdown={dropdown}
      className="flex flex-col"
      bodyClassName="max-h-64"
      hasBackdrop
      trigger={
        <Tooltip
          content={reason ?? 'Move this issue through its Jira workflow'}
          isSuppressed={isOpen}
        >
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-disabled={isBlocked}
            aria-label={`${state.label}, move this issue`}
            onClick={toggle}
            className={cn(
              'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-chip',
              tintClasses(state.tone).bg,
              tintClasses(state.tone).text,
              (isBlocked || busyId != null) && 'opacity-50',
            )}
          >
            {state.label}
            <ChevronDown size={ICON_SIZE.mark} aria-hidden />
          </button>
        </Tooltip>
      }
    >
      <AppMenuList label="Move this issue" entries={entries} onClose={close} />
    </AnchoredPopover>
  );
};
