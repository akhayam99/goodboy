import type { CSSProperties, ReactNode } from 'react';
import type { AgentRole } from '@goodboy/types';
import { WorkNode, cn } from '@goodboy/ui';
import { ROLE_LABEL, type AgentKind } from '../../../agent-kind';
import { AgentKindChip } from '../../AgentKindChip';
import { StepTreeGutter } from '../../../../workflows/components/StepTree/StepTreeGutter';
import type { StepLaneSpan } from '../../../../workflows/components/StepTree/StepTreeLane';

type Props = {
  readonly identityIndex: number;
  readonly children: ReactNode;
};

type ExampleStep = {
  readonly role: AgentRole;
  readonly kind: AgentKind;
  readonly titleWidth: string;
};

const EXAMPLE_STEPS: ReadonlyArray<ExampleStep> = [
  { role: 'scout', kind: 'scout', titleWidth: 'w-2/5' },
  { role: 'planner', kind: 'planner', titleWidth: 'w-1/3' },
  { role: 'implementer', kind: 'implementer', titleWidth: 'w-5/12' },
];

const ENTRY_STAGGER_MS = 120;

const ENTRY_CLASS = 'motion-safe:animate-fade-in motion-safe:[animation-fill-mode:backwards]';

type EntryParams = {
  readonly order: number;
};

const entryDelay = ({ order }: EntryParams): CSSProperties => ({
  animationDelay: `${order * ENTRY_STAGGER_MS}ms`,
});

type SpanParams = {
  readonly index: number;
};

const spanOf = ({ index }: SpanParams): StepLaneSpan =>
  index === EXAMPLE_STEPS.length - 1 ? 'tip' : 'through';

export const ExampleSteps = ({ identityIndex, children }: Props) => (
  <div className="flex min-w-0 flex-col">
    <div
      className={cn('flex min-w-0 gap-1.5', ENTRY_CLASS)}
      style={entryDelay({ order: EXAMPLE_STEPS.length + 1 })}
    >
      <StepTreeGutter span="none" identityIndex={identityIndex} />
      <p className="pb-1 pl-2 text-2xs leading-4 text-faint-foreground">
        Example. Real steps are picked one at a time as the run goes.
      </p>
    </div>
    <ol className="flex flex-col-reverse">
      {children}
      {EXAMPLE_STEPS.map((step, index) => (
        <li
          key={step.role}
          aria-hidden
          data-example-step={step.role}
          className={cn('flex min-w-0 gap-1.5 opacity-70', ENTRY_CLASS)}
          style={entryDelay({ order: index + 1 })}
        >
          <StepTreeGutter
            span={spanOf({ index })}
            identityIndex={identityIndex}
            node={
              <WorkNode
                state="queued"
                mark={{ kind: 'index', value: String(index + 1) }}
                label={`Example step ${index + 1}`}
              />
            }
          />
          <span className="flex h-8 min-w-0 flex-1 items-center gap-2.5 pl-2">
            <AgentKindChip kind={step.kind} label={ROLE_LABEL[step.role]} muted />
            <span className={cn('h-2 rounded-sm bg-muted', step.titleWidth)} />
          </span>
        </li>
      ))}
    </ol>
  </div>
);
