import { useState } from 'react';
import { Button } from '@goodboy/ui';
import { RESOLVER_ACTION_ICON } from '../../resolverActionIcon';
import { RESOLVER_ACTION_BUSY_LABEL } from '../../resolverActionBusyLabel';
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
        isBusy={actions.runningAction === armedAction.kind}
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
  const running = actions.runningAction;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {plan.note !== null && (
        <span className="text-2xs font-medium text-muted-foreground">{plan.note}</span>
      )}
      {plan.primary !== null && PrimaryIcon !== null && (
        <Button
          size="sm"
          variant="primary"
          isBusy={running === plan.primary.kind}
          busyLabel={RESOLVER_ACTION_BUSY_LABEL[plan.primary.kind]}
          disabled={!plan.primary.isEnabled || running !== null}
          onClick={() => {
            const action = plan.primary;
            if (action === null) {
              return;
            }
            if (action.confirm === null) {
              void actions.run(action.kind);
              return;
            }
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
          isBusy={running === plan.secondary.kind}
          busyLabel={RESOLVER_ACTION_BUSY_LABEL[plan.secondary.kind]}
          disabled={!plan.secondary.isEnabled || running !== null}
          onClick={() => {
            const action = plan.secondary;
            if (action === null) {
              return;
            }
            if (action.confirm === null) {
              void actions.run(action.kind);
              return;
            }
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
