import { useEffect, useId, useRef } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { useKickoffIssues } from './useKickoffIssues';
import { preselectStartChoice, type StartChoice } from './startChoice';
import { StartOptionList } from './StartOptionList';
import { TaskStart } from './TaskStart';
import { WorkflowStart } from './WorkflowStart';
import { ScoutStart } from './ScoutStart';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const SessionKickoff = ({ workspaceId }: Props) => {
  const issues = useKickoffIssues({ workspaceId });
  const storedChoice = useAppStore((state) => selectSessionDraft({ state, workspaceId }).choice);
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const sectionRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const questionId = useId();

  const hasTrackerCandidates = issues.hasSources && (!issues.isLoaded || issues.rows.length > 0);
  const choice = storedChoice ?? preselectStartChoice({ hasTrackerCandidates });

  useEffect(() => {
    sectionRef.current
      ?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]')
      ?.focus();
  }, []);

  const pick = (next: StartChoice) => {
    patchSessionDraft({ workspaceId, patch: { choice: next } });
  };

  const confirm = (next: StartChoice) => {
    pick(next);
    requestAnimationFrame(() => {
      bodyRef.current?.querySelector<HTMLElement>('[data-kickoff-field]')?.focus();
    });
  };

  return (
    <section ref={sectionRef} aria-label="Kickoff" className="flex flex-col gap-2">
      <header className="flex items-center gap-2 px-0.5">
        <h3 id={questionId} className="text-row text-foreground">
          How do you want to start?
        </h3>
      </header>
      <StartOptionList labelledBy={questionId} value={choice} onChange={pick} onConfirm={confirm} />
      <div ref={bodyRef} className="flex flex-col px-0.5 pt-1">
        {choice === 'task' ? <TaskStart workspaceId={workspaceId} issues={issues} /> : null}
        {choice === 'workflow' ? <WorkflowStart workspaceId={workspaceId} /> : null}
        {choice === 'scout' ? <ScoutStart workspaceId={workspaceId} /> : null}
      </div>
    </section>
  );
};
