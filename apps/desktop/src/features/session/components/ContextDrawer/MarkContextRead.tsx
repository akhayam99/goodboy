import { useState } from 'react';
import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { nowIso } from '../../../../store/slices/project-mounts/nowIso';
import {
  hasDecisionChanges,
  type DecisionChangesSince,
} from '../../../../store/slices/contextDrawer/decisionChangesSince';

type Props = {
  readonly sessionId: SessionId;
  readonly changes: DecisionChangesSince;
};

export const MarkContextRead = ({ sessionId, changes }: Props) => {
  const markContextRead = useAppStore((state) => state.markContextRead);
  const reportError = useAppStore((state) => state.reportError);
  const [isSaving, setIsSaving] = useState(false);
  const markRead = async () => {
    const readAt = nowIso({});
    setIsSaving(true);
    try {
      await markContextRead({ sessionId, readAt });
    } catch (error: unknown) {
      void reportError({ title: "Couldn't mark the changes as read", error, sessionId });
    } finally {
      setIsSaving(false);
    }
  };
  if (!hasDecisionChanges(changes)) {
    return null;
  }
  return (
    <Button variant="ghost" size="sm" disabled={isSaving} onClick={() => void markRead()}>
      Mark as read
    </Button>
  );
};
