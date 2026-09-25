import { useRef, type KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { START_CHOICES, type StartChoice } from './startChoice';

type StartOption = {
  readonly title: string;
  readonly line: string;
  readonly icon: LucideIcon;
};

const START_OPTIONS: Readonly<Record<StartChoice, StartOption>> = {
  task: {
    title: 'Pick up a task',
    line: 'Start from an issue in your tracker.',
    icon: CONCEPT_ICONS.issues,
  },
  workflow: {
    title: 'Run a workflow',
    line: 'Describe the goal, then pick a workflow.',
    icon: CONCEPT_ICONS.workflows,
  },
  scout: {
    title: 'Not sure yet',
    line: 'A Scout reads the project and suggests where to start.',
    icon: CONCEPT_ICONS.explore,
  },
};

type Props = {
  readonly labelledBy: string;
  readonly value: StartChoice;
  readonly onChange: (choice: StartChoice) => void;
  readonly onConfirm: (choice: StartChoice) => void;
};

const NEXT_KEYS: ReadonlySet<string> = new Set(['ArrowDown', 'ArrowRight']);
const PREVIOUS_KEYS: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowLeft']);

type StepParams = {
  readonly from: StartChoice;
  readonly by: number;
};

const stepChoice = ({ from, by }: StepParams): StartChoice => {
  const index = START_CHOICES.indexOf(from);
  const next = (index + by + START_CHOICES.length) % START_CHOICES.length;
  return START_CHOICES[next] ?? from;
};

export const StartOptionList = ({ labelledBy, value, onChange, onConfirm }: Props) => {
  const radioRefs = useRef<Partial<Record<StartChoice, HTMLButtonElement | null>>>({});

  const moveTo = (choice: StartChoice) => {
    onChange(choice);
    radioRefs.current[choice]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (NEXT_KEYS.has(event.key)) {
      event.preventDefault();
      moveTo(stepChoice({ from: value, by: 1 }));
      return;
    }
    if (PREVIOUS_KEYS.has(event.key)) {
      event.preventDefault();
      moveTo(stepChoice({ from: value, by: -1 }));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      onConfirm(value);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-0.5"
    >
      {START_CHOICES.map((choice) => {
        const option = START_OPTIONS[choice];
        const Icon = option.icon;
        const isChecked = choice === value;
        return (
          <button
            key={choice}
            ref={(node) => {
              radioRefs.current[choice] = node;
            }}
            type="button"
            role="radio"
            aria-checked={isChecked}
            tabIndex={isChecked ? 0 : -1}
            onClick={() => onChange(choice)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              isChecked ? 'bg-selected' : 'hover:bg-hover',
            )}
          >
            <Icon
              size={ICON_SIZE.control}
              aria-hidden
              className={cn('shrink-0', isChecked ? 'text-primary' : 'text-muted-foreground')}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium text-foreground">{option.title}</span>
              <span className="truncate text-xs text-muted-foreground">{option.line}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};
