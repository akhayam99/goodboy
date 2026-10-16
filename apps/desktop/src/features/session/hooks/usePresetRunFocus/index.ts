import { useShallow } from 'zustand/react/shallow';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { presetRunFocusOf, type PresetRunFocus } from '../../../workflows/presetRunFocusOf';

type Params = {
  readonly sessionId: SessionId | null;
};

type FocusSlice = {
  readonly runId: PresetRunFocus['runId'] | null;
  readonly agentId: PresetRunFocus['agentId'];
};

const NO_FOCUS: FocusSlice = { runId: null, agentId: null };

export const usePresetRunFocus = ({ sessionId }: Params): PresetRunFocus | null => {
  const focus = useAppStore(
    useShallow((state): FocusSlice => {
      if (sessionId === null) {
        return NO_FOCUS;
      }
      const found = presetRunFocusOf({
        lens: state.activeLens[sessionId] ?? null,
        focusedRunId: state.focusedWorkflowRunId[sessionId] ?? null,
        selectedAgentId: state.selectedAgentId[sessionId] ?? null,
        runs: sessionById(state.sessions, sessionId)?.workflowRuns ?? EMPTY_ARRAY,
        agents: state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY,
      });
      return found ?? NO_FOCUS;
    }),
  );
  return focus.runId === null ? null : { runId: focus.runId, agentId: focus.agentId };
};
