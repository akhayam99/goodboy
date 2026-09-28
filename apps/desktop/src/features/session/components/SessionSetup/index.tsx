import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SectionHeader, inlineMarkdownText } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useSessionSlots } from '../../../../store';
import type { SessionSetupStep } from '../../../../store/slices/sessionStart/state';
import { GoalStep } from './GoalStep';
import { ProjectStep } from './ProjectStep';
import { SetupStepRow } from './SetupStepRow';
import { WorkStep } from './WorkStep';
import type { SetupStepView } from './sessionSetupSteps';

type Props = {
  readonly session: Session;
  readonly steps: ReadonlyArray<SetupStepView>;
};

type StepCopy = {
  readonly title: string;
  readonly line: string;
  readonly skipped: string;
};

const STEP_COPY: Readonly<Record<SessionSetupStep, StepCopy>> = {
  goal: {
    title: 'Goal',
    line: 'Say what this session should get done.',
    skipped: 'No goal yet',
  },
  project: {
    title: 'Project',
    line: 'Pick the project the agents work in.',
    skipped: 'Session folder',
  },
  work: {
    title: 'Start the work',
    line: 'Run a workflow, or start one agent.',
    skipped: '',
  },
};

export const SessionSetup = ({ session, steps }: Props) => {
  const sessionId = session.id;
  const slots = useSessionSlots(sessionId);
  const focusSessionSetupStep = useAppStore((state) => state.focusSessionSetupStep);
  const projectNames = useAppStore(
    useShallow((state) =>
      (state.sessionProjectMounts[sessionId] ?? EMPTY_ARRAY).flatMap(
        (mount) => state.projects.find((project) => project.id === mount.projectId)?.name ?? [],
      ),
    ),
  );
  const goal = inlineMarkdownText({ text: slots.find((slot) => slot.key === 'goal')?.value ?? '' })
    .replace(/\s+/g, ' ')
    .trim();

  const summaryOf = ({ step, status }: SetupStepView): string | null => {
    if (status === 'skipped') {
      return STEP_COPY[step].skipped;
    }
    if (status !== 'done') {
      return null;
    }
    return step === 'goal' ? goal : projectNames.join(', ');
  };

  const bodyOf = (step: SessionSetupStep): ReactNode => {
    switch (step) {
      case 'goal':
        return <GoalStep session={session} />;
      case 'project':
        return <ProjectStep session={session} />;
      case 'work':
        return <WorkStep session={session} />;
      default: {
        const unreachable: never = step;
        return unreachable;
      }
    }
  };

  return (
    <section aria-label="Set up" className="flex min-w-0 flex-col gap-2">
      <SectionHeader label="Set up this session" />
      <ol aria-label="Set up this session" className="flex flex-col gap-1">
        {steps.map((view, index) => (
          <SetupStepRow
            key={view.step}
            ordinal={index + 1}
            status={view.status}
            title={STEP_COPY[view.step].title}
            line={STEP_COPY[view.step].line}
            summary={summaryOf(view)}
            onFocus={() => focusSessionSetupStep({ sessionId, step: view.step })}
          >
            {view.status === 'current' ? bodyOf(view.step) : null}
          </SetupStepRow>
        ))}
      </ol>
    </section>
  );
};
