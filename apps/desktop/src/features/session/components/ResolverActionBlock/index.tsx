import { useState } from 'react';
import { Button } from '@goodboy/ui';
import { RESOLVER_ACTION_ICON } from '../../resolverActionIcon';
import type { ResolverActionKind } from '../../resolverActions';
import type { ResolverActionsController } from '../../hooks/useResolverActions';
import { ResolverConfirm } from '../ResolverConfirm';

type Props = {
  readonly actions: ResolverActionsController;
};

export const ResolverActionBlock = ({ actions }: Props) => {
  const [armed, setArmed] = useState<ResolverActionKind | null>(null);
  const { plan } = actions;

  if (plan.primary === null && plan.secondary === null && plan.note === null) {
    return null;
  }

  const armedAction = [plan.primary, plan.secondary].find(
    (action) => action != null && action.kind === armed,
  );

  if (armedAction != null) {
    return (
      <ResolverConfirm
        action={armedAction}
        explanation={actions.explanation}
        threadCount={actions.threadCount}
        onExplanationChange={actions.setExplanation}
        onConfirm={async () => {
          await actions.run(armedAction.kind);
          setArmed(null);
        }}
        onCancel={() => setArmed(null)}
      />
    );
  }

  const PrimaryIcon = plan.primary === null ? null : RESOLVER_ACTION_ICON[plan.primary.kind];
  const SecondaryIcon = plan.secondary === null ? null : RESOLVER_ACTION_ICON[plan.secondary.kind];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {plan.note !== null && (
        <span className="text-2xs font-medium text-muted-foreground">{plan.note}</span>
      )}
      {plan.primary !== null && PrimaryIcon !== null && (
        <Button
          size="sm"
          variant="primary"
          disabled={!plan.primary.isEnabled}
          onClick={() => {
            const action = plan.primary;
            if (action === null) {
              return;
            }
            if (action.confirm === null) {
              void actions.run(action.kind);
              return;
            }
            actions.resetExplanation();
            setArmed(action.kind);
          }}
        >
          <PrimaryIcon size={11} aria-hidden />
          {plan.primary.label}
        </Button>
      )}
      {plan.secondary !== null && SecondaryIcon !== null && (
        <Button
          size="sm"
          variant="ghost"
          disabled={!plan.secondary.isEnabled}
          onClick={() => {
            const action = plan.secondary;
            if (action === null) {
              return;
            }
            if (action.confirm === null) {
              void actions.run(action.kind);
              return;
            }
            actions.resetExplanation();
            setArmed(action.kind);
          }}
        >
          <SecondaryIcon size={11} aria-hidden />
          {plan.secondary.label}
        </Button>
      )}
    </div>
  );
};
