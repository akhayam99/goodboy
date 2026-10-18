import { useState } from 'react';
import { Button, FormActions, KeyHint, SegmentedTabs, cn, formatError } from '@goodboy/ui';
import type { Project, ProjectId, ProviderId, WorkspaceId } from '@goodboy/types';
import { PromptField } from '../../../../shared/components/PromptField';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { useFirstIssues } from '../useFirstIssues';
import { wizardCta } from '../wizardCta';
import type { WizardMode } from '../wizardSteps';
import { AgentGlyph } from './AgentGlyph';
import { HandOff } from './HandOff';
import { NoIssueSource } from './NoIssueSource';
import { StepHeading } from './StepHeading';

export type FirstSessionTab = 'ask' | 'task';

type Target = {
  readonly workspaceId: WorkspaceId;
  readonly projectId: ProjectId | null;
};

type StartParams = Target & {
  readonly prompt: string;
};

type DraftParams = Target & {
  readonly issue: IssueCandidate;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly folder: Project | null;
  readonly agent: ProviderId;
  readonly mode: WizardMode;
  readonly isLocked: boolean;
  readonly initialTab?: FirstSessionTab;
  readonly onBack: (() => void) | null;
  readonly onSkip: () => void;
  readonly onStart: (params: StartParams) => Promise<void>;
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

const PILL_CLASS =
  'inline-flex h-6 shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-fill px-2 text-label text-foreground';

export const FirstSessionStep = ({
  workspaceId,
  folder,
  agent,
  mode,
  isLocked,
  initialTab = 'ask',
  onBack,
  onSkip,
  onStart,
  onDraft,
  onOpenTools,
}: Props) => {
  const [target] = useState<Target>(() => ({ workspaceId, projectId: folder?.id ?? null }));
  const issues = useFirstIssues({ workspaceId: target.workspaceId });
  const folderName = folder?.name ?? 'this workspace';
  const [tab, setTab] = useState<FirstSessionTab>(initialTab);
  const [starter, setStarter] = useState(0);
  const [prompt, setPrompt] = useState(() => STARTERS[0]?.prompt(folderName) ?? '');
  const [picked, setPicked] = useState<IssueCandidate | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTask = issues.hasSources && tab === 'task';
  const pickedIssue = picked ?? issues.rows[0] ?? null;
  const cta = wizardCta({
    step: 'first-session',
    mode,
    readyCount: 0,
    isIssuePick: isTask,
    hasFailed: error !== null,
  });
  const isBlocked = isLocked || isStarting;
  const canStart = !isBlocked && (isTask ? pickedIssue !== null : prompt.trim().length > 0);
  const branch = folder?.baseBranch ?? null;

  const pickStarter = (index: number) => {
    setStarter(index);
    setPrompt(STARTERS[index]?.prompt(folderName) ?? '');
  };

  const start = () => {
    if (!canStart) {
      return;
    }
    if (isTask) {
      if (pickedIssue !== null) {
        onDraft({ ...target, issue: pickedIssue });
      }
      return;
    }
    setIsStarting(true);
    setError(null);
    void onStart({ ...target, prompt: prompt.trim() })
      .catch((cause: unknown) => setError(formatError(cause)))
      .finally(() => setIsStarting(false));
  };

  return (
    <div className="flex flex-col gap-6">
      <StepHeading
        title="Give it a first task"
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
          onChange={setTab}
          className="self-start"
        />
      ) : null}
      {isTask ? (
        <HandOff
          issues={issues}
          folderName={folderName}
          pickedId={pickedIssue?.externalId ?? null}
          onPick={setPicked}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Starters">
            {STARTERS.map((entry, index) => (
              <button
                key={entry.label(folderName)}
                type="button"
                aria-pressed={index === starter}
                onClick={() => pickStarter(index)}
                className={cn(
                  'rounded-full border px-3 py-1 text-label motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                  index === starter
                    ? 'border-transparent bg-selected text-foreground'
                    : 'border-border-soft text-muted-foreground hover:bg-hover hover:text-foreground',
                )}
              >
                {entry.label(folderName)}
              </button>
            ))}
          </div>
          <PromptField
            kind="document"
            label="What Scout should do"
            value={prompt}
            onChange={setPrompt}
            onSubmit={start}
            isSubmitBlocked={!canStart}
            disabled={isStarting}
            minRows={3}
            maxRows={8}
            footerStart={
              <span className="flex min-w-0 items-center gap-2">
                <span className={PILL_CLASS}>
                  <AgentGlyph providerId={agent} size={ICON_SIZE.row} />
                  {PROVIDER_LABEL[agent]}
                </span>
                <span className={PILL_CLASS}>
                  Scout
                  <span className="text-faint-foreground">reads only</span>
                </span>
                <span className={PILL_CLASS}>
                  Model
                  <span className="text-faint-foreground">Auto</span>
                </span>
              </span>
            }
            actions={
              <span className="truncate pr-1 text-meta text-faint-foreground">
                {branch === null ? folderName : `${folderName} · ${branch}`}
              </span>
            }
          />
          {issues.hasSources ? null : <NoIssueSource onOpenTools={onOpenTools} />}
        </div>
      )}
      <FormActions error={error}>
        {onBack === null ? null : (
          <Button
            size="md"
            variant="ghost"
            className="text-muted-foreground"
            disabled={isBlocked}
            onClick={onBack}
          >
            Back
          </Button>
        )}
        <Button size="md" variant="secondary" disabled={isBlocked} onClick={onSkip}>
          {cta.skip}
        </Button>
        <Button
          size="md"
          variant="primary"
          disabled={!canStart}
          isBusy={isStarting}
          busyLabel="Starting session"
          onClick={start}
        >
          {cta.primary}
          <KeyHint keys={shortcutGlyphs('composer.submit')} isOnTone />
        </Button>
      </FormActions>
    </div>
  );
};
