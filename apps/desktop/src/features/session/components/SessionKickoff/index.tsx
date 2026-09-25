import { useEffect, useId, useRef, useState } from 'react';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import { useKickoffIssues } from './useKickoffIssues';
import {
  preselectStartChoice,
  readLastStartChoice,
  writeLastStartChoice,
  type StartChoice,
} from './startChoice';
import { StartOptionList } from './StartOptionList';
import { TaskStart } from './TaskStart';
import { WorkflowStart } from './WorkflowStart';
import { ScoutStart } from './ScoutStart';
import { MoreWaysMenu } from './MoreWaysMenu';

type PickIssueParams = {
  readonly candidate: IssueCandidate;
};

type Props = {
  readonly session: Session;
  readonly onOpenWorkflowBuilder: () => void;
  readonly onPickIssue?: (params: PickIssueParams) => void;
};

export const SessionKickoff = ({ session, onOpenWorkflowBuilder, onPickIssue }: Props) => {
  const issues = useKickoffIssues({ workspaceId: session.workspaceId });
  const pendingFocus = useAppStore((state) => state.pendingKickoffFocusSessionId);
  const clearPendingFocus = useAppStore((state) => state.clearPendingKickoffFocus);
  const [stored] = useState(() => readLastStartChoice({ workspaceId: session.workspaceId }));
  const [picked, setPicked] = useState<StartChoice | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const questionId = useId();

  const hasTrackerCandidates = issues.hasSources && (!issues.isLoaded || issues.rows.length > 0);
  const choice = picked ?? preselectStartChoice({ stored, hasTrackerCandidates });

  useEffect(() => {
    if (pendingFocus !== session.id) {
      return;
    }
    clearPendingFocus();
    sectionRef.current
      ?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]')
      ?.focus();
  }, [pendingFocus, session.id, clearPendingFocus]);

  const pick = (next: StartChoice) => {
    setPicked(next);
    writeLastStartChoice({ workspaceId: session.workspaceId, choice: next });
  };

  const confirm = (next: StartChoice) => {
    pick(next);
    requestAnimationFrame(() => {
      bodyRef.current?.querySelector<HTMLElement>('[data-kickoff-field]')?.focus();
    });
  };

  return (
    <section ref={sectionRef} aria-label="Kickoff" className="flex flex-col gap-2">
      <header className="flex items-center justify-between gap-2 px-0.5">
        <h3 id={questionId} className="text-sm font-medium text-foreground">
          How do you want to start?
        </h3>
        <MoreWaysMenu sessionId={session.id} />
      </header>
      <StartOptionList labelledBy={questionId} value={choice} onChange={pick} onConfirm={confirm} />
      <div ref={bodyRef} className="flex flex-col px-0.5 pt-1">
        {choice === 'task' ? (
          <TaskStart session={session} issues={issues} onPickIssue={onPickIssue} />
        ) : null}
        {choice === 'workflow' ? (
          <WorkflowStart session={session} onOpenWorkflowBuilder={onOpenWorkflowBuilder} />
        ) : null}
        {choice === 'scout' ? <ScoutStart session={session} /> : null}
      </div>
    </section>
  );
};
