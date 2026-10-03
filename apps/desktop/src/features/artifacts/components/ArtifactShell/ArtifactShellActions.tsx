import { useContext, useEffect } from 'react';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import { ArtifactHeaderMenuContext, artifactViewingOf } from './artifactHeaderMenu';
import { ArtifactOverflowMenu } from './ArtifactOverflowMenu';
import type { ActionSlot, ArtifactActionTarget, ResolvedAction } from '../../../actions/types';

type Props = {
  readonly target: ArtifactActionTarget;
  readonly onArm: (params: {
    readonly action: ResolvedAction;
    readonly run: () => Promise<void>;
  }) => void;
};

const BUTTON_ORDER: Readonly<Partial<Record<ActionSlot, number>>> = { secondary: 0, primary: 1 };

export const ArtifactShellActions = ({ target, onArm }: Props) => {
  const viewing = artifactViewingOf({ target });
  const env = useActionEnv({ origin: 'button', viewing });
  const { actions, run } = useObjectActions({ target, env });
  const registerMenu = useContext(ArtifactHeaderMenuContext);

  useEffect(() => {
    registerMenu?.(target);
    return () => registerMenu?.(null);
  }, [registerMenu, target]);
  const buttons = actions
    .filter((action) => BUTTON_ORDER[action.slot] !== undefined)
    .slice()
    .sort((left, right) => (BUTTON_ORDER[left.slot] ?? 0) - (BUTTON_ORDER[right.slot] ?? 0));

  return (
    <span data-testid="artifact-actions" className="flex min-w-0 shrink-0 items-center gap-1.5">
      {buttons.map((action) => (
        <Button
          key={action.id}
          variant={action.slot === 'primary' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            if (action.confirm !== null) {
              onArm({ action, run: () => run({ actionId: action.id }) });
              return;
            }
            void run({ actionId: action.id });
          }}
          disabled={action.blockedReason !== null || action.isBusy}
          isBusy={action.isBusy}
          title={action.blockedReason ?? action.description ?? undefined}
          data-testid={`artifact-action-${action.id.replace('artifact.', '')}`}
        >
          <action.icon size={ICON_SIZE.row} aria-hidden />
          {action.label}
        </Button>
      ))}
      {actions.length > 0 ? (
        <ArtifactOverflowMenu
          target={target}
          label="More"
          triggerClassName="p-1.5"
          viewing={viewing}
        />
      ) : null}
    </span>
  );
};
