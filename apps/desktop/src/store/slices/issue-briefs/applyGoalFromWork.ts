import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { sessionById } from '../sessions/sessionIndex';

type WriteParams = { readonly sessionId: SessionId; readonly title: string; readonly goal: string };

const replace = async ({ sessionId, title, goal }: WriteParams): Promise<void> => {
  const state = useAppStore.getState();
  const session = sessionById(state.sessions, sessionId);
  if (session === undefined) {
    throw new Error('This session is no longer available.');
  }
  const previousTitle = session.goal;
  const previousGoal =
    state.sessionSlots[sessionId]?.find((slot) => slot.key === 'goal')?.value ?? '';
  await state.renameTask(sessionId, title);
  try {
    await state.upsertSessionSlot(sessionId, 'goal', goal);
  } catch (error) {
    await state.renameTask(sessionId, previousTitle);
    await state.upsertSessionSlot(sessionId, 'goal', previousGoal);
    throw error;
  }
};

type Params = WriteParams;

export const applyGoalFromWork = async ({ sessionId, title, goal }: Params): Promise<void> => {
  const state = useAppStore.getState();
  const session = sessionById(state.sessions, sessionId);
  if (session === undefined) {
    throw new Error('This session is no longer available.');
  }
  const previousTitle = session.goal;
  const previousGoal =
    state.sessionSlots[sessionId]?.find((slot) => slot.key === 'goal')?.value ?? '';
  await replace({ sessionId, title, goal });
  const appliedTitle = sessionById(useAppStore.getState().sessions, sessionId)?.goal;
  state.undoable({
    title: 'Title and goal updated',
    message: 'Written from linked work.',
    conflictMessage: 'The title or goal changed since. Your edits were kept.',
    undo: async () => {
      const current = useAppStore.getState();
      if (
        sessionById(current.sessions, sessionId)?.goal !== appliedTitle ||
        (current.sessionSlots[sessionId]?.find((slot) => slot.key === 'goal')?.value ?? '') !== goal
      ) {
        return false;
      }
      await replace({ sessionId, title: previousTitle, goal: previousGoal });
      return true;
    },
  });
};
