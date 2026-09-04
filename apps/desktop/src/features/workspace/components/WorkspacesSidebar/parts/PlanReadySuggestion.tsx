import { useState } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useAgentStartedToast } from '../../../../../shared/hooks/useAgentStartedToast';
import { useSessionSuggestions } from '../../../../suggestions';
import { SuggestionRow } from '../../../../suggestions/components/SuggestionRow';

type Props = {
  task: Session;
};

export const PlanReadySuggestion = ({ task }: Props) => {
  const suggestions = useSessionSuggestions({ session: task, withRebase: false });
  const runPlan = useAppStore((s) => s.runPlan);
  const announceAgentStarted = useAgentStartedToast();
  const [spawning, setSpawning] = useState(false);

  const suggestion = suggestions.find((candidate) => candidate.kind === 'plan-ready') ?? null;
  if (suggestion == null || suggestion.kind !== 'plan-ready') {
    return null;
  }

  const onSpawn = async () => {
    if (spawning) {
      return;
    }
    setSpawning(true);
    try {
      const agentId = await runPlan(task.id, suggestion.payload.planId);
      announceAgentStarted({
        sessionId: task.id,
        agentId,
        title: 'Implementer started',
        message: 'An agent is running this plan. You can keep working.',
      });
    } finally {
      setSpawning(false);
    }
  };

  return (
    <SuggestionRow
      suggestion={suggestion}
      size="compact"
      actionLabel="Run"
      isDisabled={spawning}
      onAction={() => void onSpawn()}
    />
  );
};
