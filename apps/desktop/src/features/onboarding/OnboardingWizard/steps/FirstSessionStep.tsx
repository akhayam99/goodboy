import { useEffect, useState } from 'react';
import { Button, cn, FormActions, KeyHint, SegmentedTabs, FOCUS_RING } from '@goodboy/ui';
import type { Project, ProjectId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import { StartRun } from '../../../session/startRun/StartRun';
import { useFirstIssues } from '../useFirstIssues';
import { wizardCta } from '../wizardCta';
import type { WizardMode } from '../wizardSteps';
import { HandOff } from './HandOff';
import { NoIssueSource } from './NoIssueSource';
import { StepHeading } from './StepHeading';

export type FirstSessionTab = 'ask' | 'task';

type Target = {
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
};

type DraftParams = Target & {
  readonly issue: IssueCandidate;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly folder: Project | null;
  readonly mode: WizardMode;
  readonly isLocked: boolean;
  readonly onBack: (() => void) | null;
  readonly onSkip: () => void;
  readonly onStarted: () => void;
  readonly onDraft: (params: DraftParams) => void;
  readonly onOpenTools: (() => void) | null;
};

type Starter = {
  readonly label: (folder: string) => string;
  readonly prompt: (folder: string) => string;
};

const STARTERS: ReadonlyArray<Starter> = [
  {
    label: (folder) => `Explain how ${folder} is organized`,
    prompt: (folder) =>
      `Explain how ${folder} is organized: the main folders, how the pieces talk to each other, and where the tests live.`,
  },
  {
    label: () => 'Find one small bug',
    prompt: (folder) =>
      `Find one small, real bug in ${folder}. Say where it is and why it is a bug. Do not change any file.`,
  },
  {
    label: () => "What's missing in the README",
    prompt: (folder) =>
      `Read the README of ${folder} and list what a new teammate would miss on day one.`,
  },
];

const TABS = [
  { value: 'ask', label: 'Ask about the code' },
  { value: 'task', label: 'Pick up an issue' },
] as const satisfies ReadonlyArray<{ readonly value: FirstSessionTab; readonly label: string }>;

export const FirstSessionStep = ({
  workspaceId,
  folder,
  mode,
  isLocked,
  onBack,
  onSkip,
  onStarted,
  onDraft,
  onOpenTools,
}: Props) => {
  const [target] = useState<Target>(() => ({ workspaceId, projectId: folder?.id ?? null }));
  const issues = useFirstIssues({ workspaceId: target.workspaceId });
  const folderName = folder?.name ?? 'this workspace';
  const goal = useAppStore((state) => selectSessionDraft({ state, workspaceId }).workflowGoal);
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const [chosenTab, setChosenTab] = useState<FirstSessionTab | null>(null);
  const [picked, setPicked] = useState<IssueCandidate | null>(null);
  const starterPrompts = STARTERS.map((starter) => starter.prompt(folderName));
  const isUntouched = goal.trim() === '' || starterPrompts.includes(goal);
  const hasRows = issues.hasSources && issues.rows.length > 0;
  const tab: FirstSessionTab = chosenTab ?? (hasRows && isUntouched ? 'task' : 'ask');
  const isTask = issues.hasSources && tab === 'task';
  const pickedIssue = picked ?? issues.rows[0] ?? null;
  const cta = wizardCta({
    step: 'first-session',
    mode,
    readyCount: 0,
    isIssuePick: isTask,
    hasFailed: false,
  });
  const canDraft = !isLocked && pickedIssue !== null;

  useEffect(() => {
    const current = selectSessionDraft({
      state: useAppStore.getState(),
      workspaceId: target.workspaceId,
    }).workflowGoal;
    patchSessionDraft({
      workspaceId: target.workspaceId,
      patch: {
        projectIds: target.projectId === null ? [] : [target.projectId],
        ...(current.trim() === '' && { workflowGoal: STARTERS[0]?.prompt(folderName) ?? '' }),
      },
    });
  }, [folderName, patchSessionDraft, target.projectId, target.workspaceId]);

  const pickStarter = (index: number) => {
    patchSessionDraft({
      workspaceId: target.workspaceId,
      patch: { workflowGoal: starterPrompts[index] ?? '' },
    });
  };

  const skip = () => {
    if (starterPrompts.includes(goal)) {
      patchSessionDraft({ workspaceId: target.workspaceId, patch: { workflowGoal: '' } });
    }
    onSkip();
  };

  const draft = () => {
    if (canDraft && pickedIssue !== null) {
      onDraft({ ...target, issue: pickedIssue });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="Start your first session"
        line={
          isTask
            ? 'Pick an issue. An agent plans it in its own branch, and nothing is pushed.'
            : `Scout reads ${folderName} and answers in a new session. It changes nothing.`
        }
      />
      {issues.hasSources ? (
        <SegmentedTabs
          ariaLabel="How to start"
          options={TABS}
          value={tab}
          onChange={setChosenTab}
          className="self-start"
        />
      ) : null}
      {isTask ? (
        <>
          <HandOff
            issues={issues}
            folderName={folderName}
            pickedId={pickedIssue?.externalId ?? null}
            onPick={setPicked}
          />
          <FormActions>
            {onBack === null ? null : (
              <Button
                size="md"
                variant="ghost"
                className="text-muted-foreground"
                disabled={isLocked}
                onClick={onBack}
              >
                Back
              </Button>
            )}
            <Button size="md" variant="secondary" disabled={isLocked} onClick={skip}>
              {cta.skip}
            </Button>
            <Button size="md" variant="primary" disabled={!canDraft} onClick={draft}>
              {cta.primary}
              <KeyHint keys={shortcutGlyphs('composer.submit')} isOnTone />
            </Button>
          </FormActions>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Starters">
            {STARTERS.map((entry, index) => (
              <button
                key={entry.label(folderName)}
                type="button"
                aria-pressed={goal === starterPrompts[index]}
                onClick={() => pickStarter(index)}
                className={cn(
                  'rounded-full border px-3 py-1 text-meta motion-safe:transition-colors',
                  FOCUS_RING,
                  goal === starterPrompts[index]
                    ? 'border-transparent bg-selected text-foreground'
                    : 'border-border-soft text-muted-foreground hover:bg-hover hover:text-foreground',
                )}
              >
                {entry.label(folderName)}
              </button>
            ))}
          </div>
          <StartRun
            workspaceId={target.workspaceId}
            sessionId={null}
            role="scout"
            hint={null}
            demoAnchor="setup-first-start"
            placeholder={`What should Scout read in ${folderName}?`}
            onStarted={onStarted}
            actions={({ isStarting }) => (
              <>
                {onBack === null ? null : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    disabled={isLocked || isStarting}
                    onClick={onBack}
                  >
                    Back
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isLocked || isStarting}
                  onClick={skip}
                >
                  {cta.skip}
                </Button>
              </>
            )}
          />
          {issues.hasSources ? null : <NoIssueSource onOpenTools={onOpenTools} />}
        </div>
      )}
    </div>
  );
};
