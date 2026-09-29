import { useId, useState, type KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button, KbdPill, Textarea, cn } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatCombo } from '../../../../shared/keyboard/registry';
import { StepHeading } from './StepHeading';
import { NoIssueSource } from './NoIssueSource';
import { HandOff } from './HandOff';

export type FirstSessionChoice = 'task' | 'workflow' | 'agent';

const CHOICES: ReadonlyArray<FirstSessionChoice> = ['task', 'workflow', 'agent'];

const CHOICE_META: Readonly<
  Record<
    FirstSessionChoice,
    { readonly title: string; readonly line: string; readonly icon: LucideIcon }
  >
> = {
  task: {
    title: 'Pick up a task',
    line: 'An issue from your tracker.',
    icon: CONCEPT_ICONS.issues,
  },
  workflow: {
    title: 'Run a workflow',
    line: 'Preset or orchestrated.',
    icon: CONCEPT_ICONS.workflows,
  },
  agent: { title: 'Ask an agent', line: 'Scout or any other role.', icon: CONCEPT_ICONS.explore },
};

type Starter = {
  readonly label: string;
  readonly prompt: (project: string) => string;
};

const FIRST_SESSION_STARTERS: ReadonlyArray<Starter> = [
  {
    label: 'Explain how this project is organized',
    prompt: (project) =>
      `Explain how ${project} is organized: the main folders, how the pieces talk to each other, and where the tests live.`,
  },
  {
    label: 'Find one small bug',
    prompt: (project) =>
      `Find one small bug in ${project} and propose a fix. Don't change any files yet.`,
  },
  {
    label: "What's missing in the README",
    prompt: (project) => `Read the README of ${project} and list what's missing or out of date.`,
  },
];

type Props = {
  readonly projectName: string;
  readonly hasIssueSource: boolean;
  readonly busy: boolean;
  readonly onStartScout: (prompt: string) => void;
  readonly onHandOff: (choice: Exclude<FirstSessionChoice, 'agent'>) => void;
  readonly onBackToCodeHost: (() => void) | null;
  readonly onConnectTaskManager: (() => void) | null;
};

const NEXT_KEYS: ReadonlySet<string> = new Set(['ArrowRight', 'ArrowDown']);
const PREVIOUS_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowUp']);

export const FirstSessionStep = ({
  projectName,
  hasIssueSource,
  busy,
  onStartScout,
  onHandOff,
  onBackToCodeHost,
  onConnectTaskManager,
}: Props) => {
  const [choice, setChoice] = useState<FirstSessionChoice>('agent');
  const [starter, setStarter] = useState(0);
  const [prompt, setPrompt] = useState(() => FIRST_SESSION_STARTERS[0]?.prompt(projectName) ?? '');
  const panelId = useId();
  const canStart = prompt.trim().length > 0 && !busy;

  const pickStarter = (index: number) => {
    setStarter(index);
    setPrompt(FIRST_SESSION_STARTERS[index]?.prompt(projectName) ?? '');
  };

  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const by = NEXT_KEYS.has(event.key) ? 1 : PREVIOUS_KEYS.has(event.key) ? -1 : 0;
    if (by === 0) {
      return;
    }
    event.preventDefault();
    const index = (CHOICES.indexOf(choice) + by + CHOICES.length) % CHOICES.length;
    setChoice(CHOICES[index] ?? choice);
  };

  const start = () => {
    if (canStart) {
      onStartScout(prompt.trim());
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <StepHeading
        title="Give your first agent something to do"
        line="The same three ways you'll start every session."
      />
      <div
        role="tablist"
        aria-label="How to start"
        onKeyDown={onTabKey}
        className="grid grid-cols-3 gap-2"
      >
        {CHOICES.map((id) => {
          const meta = CHOICE_META[id];
          const Icon = meta.icon;
          const isSelected = id === choice;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={panelId}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setChoice(id)}
              className={cn(
                'flex min-w-0 flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                isSelected
                  ? 'border-border-strong bg-selected'
                  : 'border-border-soft hover:bg-hover',
              )}
            >
              <Icon
                size={ICON_SIZE.control}
                aria-hidden
                className={isSelected ? 'text-primary' : 'text-muted-foreground'}
              />
              <span className="text-row text-foreground">{meta.title}</span>
              <span className="text-secondary text-muted-foreground">{meta.line}</span>
            </button>
          );
        })}
      </div>
      <div id={panelId} role="tabpanel" aria-label={CHOICE_META[choice].title}>
        {choice === 'agent' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Starters">
              {FIRST_SESSION_STARTERS.map((entry, index) => (
                <button
                  key={entry.label}
                  type="button"
                  aria-pressed={index === starter}
                  onClick={() => pickStarter(index)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-label motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                    index === starter
                      ? 'border-border-strong bg-selected text-foreground'
                      : 'border-border-soft text-muted-foreground hover:bg-hover hover:text-foreground',
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col rounded-lg border border-border-soft bg-subtle focus-within:border-border-strong">
              <Textarea
                value={prompt}
                aria-label="What Scout should do"
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    start();
                  }
                }}
                minRows={3}
                maxRows={8}
                autoGrow
                className="resize-none border-0 bg-transparent px-3 py-2 text-body text-foreground shadow-none focus-visible:border-0 focus-visible:shadow-none focus-visible:ring-0"
              />
              <div className="flex items-center justify-between gap-2 px-3 pb-2">
                <span className="text-label text-muted-foreground">Scout · Auto</span>
                <Button size="sm" disabled={!canStart} isBusy={busy} onClick={start}>
                  Start Scout
                  <KbdPill aria-hidden className="h-4 min-w-4 text-secondary">
                    {formatCombo('cmd+Enter')}
                  </KbdPill>
                </Button>
              </div>
            </div>
            <p className="text-secondary text-faint-foreground">
              Scout reads your project and changes nothing. It runs with Full access, like every
              session.
            </p>
          </div>
        )}
        {choice === 'task' &&
          (hasIssueSource ? (
            <HandOff
              line="Your issues open in a new session. Pick one there and choose how to work on it."
              busy={busy}
              onOpen={() => onHandOff('task')}
            />
          ) : (
            <NoIssueSource
              onBackToCodeHost={onBackToCodeHost}
              onConnectTaskManager={onConnectTaskManager}
            />
          ))}
        {choice === 'workflow' && (
          <HandOff
            line="Describe the goal in a new session, then pick a preset or let Goodboy orchestrate."
            busy={busy}
            onOpen={() => onHandOff('workflow')}
          />
        )}
      </div>
    </div>
  );
};
