import { useEffect, useRef, type AnimationEvent, type ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import type { StepTransitionState } from './useStepTransition';

type Props<T extends string> = {
  readonly transition: StepTransitionState<T>;
  readonly renderStep: (step: T) => ReactNode;
};

const PAGE_CLASS =
  'col-start-1 row-start-1 min-w-0 data-[direction=back]:[--wizard-step-shift:-8px]';

export const StepTransition = <T extends string>({ transition, renderStep }: Props<T>) => {
  const { current, outgoing, direction, generation, isTransitioning, removeOutgoing } = transition;
  const incomingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (generation === 0 || isTransitioning) {
      return;
    }
    incomingRef.current?.querySelector<HTMLElement>('[data-step-title]')?.focus();
  }, [generation, isTransitioning]);

  const onOutgoingEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    removeOutgoing();
  };

  return (
    <div className="grid min-w-0 grid-cols-1">
      {outgoing !== null && (
        <div
          key={outgoing}
          inert
          aria-hidden
          data-testid="wizard-step-outgoing"
          data-direction={direction}
          onAnimationEnd={onOutgoingEnd}
          className={cn(PAGE_CLASS, 'wizard-step-out pointer-events-none')}
        >
          {renderStep(outgoing)}
        </div>
      )}
      <div
        key={current}
        ref={incomingRef}
        data-testid="wizard-step-incoming"
        data-direction={direction}
        className={cn(PAGE_CLASS, generation > 0 && 'wizard-step-in')}
      >
        {renderStep(current)}
      </div>
    </div>
  );
};
