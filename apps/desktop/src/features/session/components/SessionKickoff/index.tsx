import { useEffect, useRef } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { useKickoffIssues } from './useKickoffIssues';
import { preselectStartChoice, type StartChoice } from './startChoice';
import { StartChoiceTabs } from './StartChoiceTabs';
import { TaskStart } from './TaskStart';
import { WorkflowStart } from './WorkflowStart';
import { AgentStart } from './AgentStart';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const KICKOFF_QUESTION = 'How do you want to start?';

export const SessionKickoff = ({ workspaceId }: Props) => {
  const issues = useKickoffIssues({ workspaceId });
  const storedChoice = useAppStore((state) => selectSessionDraft({ state, workspaceId }).choice);
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const sectionRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const hasTrackerCandidates = issues.hasSources && (!issues.isLoaded || issues.rows.length > 0);
  const choice = storedChoice ?? preselectStartChoice({ hasTrackerCandidates });

  useEffect(() => {
    sectionRef.current
      ?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
      ?.focus();
  }, []);

  const pick = (next: StartChoice) => {
    patchSessionDraft({ workspaceId, patch: { choice: next } });
    requestAnimationFrame(() => {
      bodyRef.current?.querySelector<HTMLElement>('[data-kickoff-field]')?.focus();
    });
  };

  return (
    <section ref={sectionRef} aria-label="Kickoff" className="flex flex-col gap-2">
      <StartChoiceTabs ariaLabel={KICKOFF_QUESTION} value={choice} onChange={pick} />
      <div ref={bodyRef} className="flex flex-col px-0.5 pt-1">
        {choice === 'task' ? <TaskStart workspaceId={workspaceId} issues={issues} /> : null}
        {choice === 'workflow' ? <WorkflowStart workspaceId={workspaceId} /> : null}
        {choice === 'scout' ? <AgentStart workspaceId={workspaceId} /> : null}
      </div>
    </section>
  );
};
