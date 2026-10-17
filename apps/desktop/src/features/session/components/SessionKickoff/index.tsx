import { useEffect, useRef, type ReactNode } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
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
  readonly notice?: ReactNode;
};

const KICKOFF_QUESTION = 'How do you want to start?';

export const SessionKickoff = ({ workspaceId, isAuto = false, notice }: Props) => {
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
        <StartChoiceTabs ariaLabel={KICKOFF_QUESTION} value={choice} onChange={pick} />
        <div className="relative">
          <p className="text-label text-muted-foreground">
            {startChoiceLine({ choice, isAuto })}
            {choice === 'scout' && isAuto ? (
              <span className="text-faint-foreground"> Experimental</span>
            ) : null}
          </p>
          {notice !== undefined && notice !== null ? (
            <div data-slot="kickoff-notice" className="absolute inset-x-0 top-full z-10 pt-2">
              {notice}
            </div>
          ) : null}
        </div>
      </div>
      <div ref={bodyRef} className="flex flex-col">
        {choice === 'task' ? <TaskStart workspaceId={workspaceId} issues={issues} /> : null}
        {choice === 'workflow' ? <WorkflowStart workspaceId={workspaceId} mode="preset" /> : null}
        {choice === 'orchestrate' ? (
          <WorkflowStart workspaceId={workspaceId} mode="dynamic" />
        ) : null}
        {choice === 'scout' && isAuto ? <AutoStart workspaceId={workspaceId} /> : null}
        {choice === 'scout' && !isAuto ? <AgentStart workspaceId={workspaceId} /> : null}
      </div>
    </section>
  );
};
