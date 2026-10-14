import { useEffect, useRef } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { useAutoExperiment } from '../../hooks/useAutoExperiment';
import { SessionDraftActions } from '../SessionDraftPane/SessionDraftActions';
import { useKickoffIssues } from './useKickoffIssues';
import { preselectStartChoice, startChoiceLine, type StartChoice } from './startChoice';
import { StartChoiceTabs } from './StartChoiceTabs';
import { TaskStart } from './TaskStart';
import { WorkflowStart } from './WorkflowStart';
import { AgentStart } from './AgentStart';
import { AutoStart } from './AutoStart';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly isAuto?: boolean;
};

const KICKOFF_QUESTION = 'How do you want to start?';

export const SessionKickoff = ({ workspaceId, isAuto }: Props) => {
  const isAutoExperiment = useAutoExperiment();
  const isAutoOn = isAuto ?? isAutoExperiment;
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
      bodyRef.current?.querySelector<HTMLElement>('[data-kickoff-field], textarea')?.focus();
    });
  };

  return (
    <section ref={sectionRef} aria-label="Kickoff" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <StartChoiceTabs ariaLabel={KICKOFF_QUESTION} value={choice} onChange={pick} />
          <SessionDraftActions workspaceId={workspaceId} />
        </div>
        <p className="text-label text-muted-foreground">
          {startChoiceLine({ choice, isAuto: isAutoOn })}
        </p>
      </div>
      <div ref={bodyRef} className="flex flex-col px-0.5">
        {choice === 'task' ? <TaskStart workspaceId={workspaceId} issues={issues} /> : null}
        {choice === 'workflow' ? <WorkflowStart workspaceId={workspaceId} /> : null}
        {choice === 'scout' && isAutoOn ? <AutoStart workspaceId={workspaceId} /> : null}
        {choice === 'scout' && !isAutoOn ? <AgentStart workspaceId={workspaceId} /> : null}
      </div>
    </section>
  );
};
