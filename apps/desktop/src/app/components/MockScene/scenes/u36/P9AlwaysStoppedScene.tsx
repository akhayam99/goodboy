import { useEffect } from 'react';
import { useAppStore } from '../../../../../store';
import { C06AgentScene } from '../u25/C06AgentScene';
import { C06_AGENT_ID } from '../u25/c06ConversationSeed';

export const P9AlwaysStoppedScene = () => {
  useEffect(() => {
    useAppStore.setState((state) => {
      const events = state.transcripts[C06_AGENT_ID] ?? [];
      const ask = events.findLast((event) => event.kind === 'permission_request');
      if (ask === undefined) {
        return state;
      }
      return {
        transcripts: {
          ...state.transcripts,
          [C06_AGENT_ID]: [
            ...events,
            {
              kind: 'permission_decision',
              runId: ask.runId,
              toolUseId: ask.toolUseId,
              decision: 'allow',
              scope: 'workspace',
              ruleId: null,
              decidedBy: 'user',
              at: ask.at,
            },
          ],
        },
      };
    });
  }, []);
  return <C06AgentScene state="permission" />;
};
