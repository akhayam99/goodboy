import { useContext, useEffect, useState, type ReactNode } from 'react';
import { Button, HeaderActions } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import { ArmedActionPopover } from '../../../../shared/components/HeaderConfirm/ArmedActionPopover';
import type { ArmedAction } from '../../../../shared/components/HeaderConfirm/armedAction';
import { ArtifactHeaderMenuContext, artifactViewingOf } from './artifactHeaderMenu';
import { ArtifactOverflowMenu } from './ArtifactOverflowMenu';
import type { ArtifactActionTarget, ResolvedAction } from '../../../actions/types';

type Props = {
  readonly target: ArtifactActionTarget;
  readonly details?: ReactNode;
};

type Armed = {
  readonly armed: ArmedAction;
  readonly origin: string;
};

const MENU_ORIGIN = 'menu';

export const ArtifactShellActions = ({ target, details = null }: Props) => {
  const [armed, setArmed] = useState<Armed | null>(null);
  const viewing = artifactViewingOf({ target });
  const env = useActionEnv({ origin: 'button', viewing });
  const { actions, run } = useObjectActions({ target, env });
  const registerMenu = useContext(ArtifactHeaderMenuContext);

  useEffect(() => {
    registerMenu?.(target);
    return () => registerMenu?.(null);
  }, [registerMenu, target]);
  const secondary = actions.find((action) => action.slot === 'secondary') ?? null;
  const primary = actions.find((action) => action.slot === 'primary') ?? null;

  const disarm = () => setArmed(null);
  const armedFor = (origin: string) => (armed?.origin === origin ? armed.armed : null);

  const buttonOf = (action: ResolvedAction, isFilled: boolean) => (
    <ArmedActionPopover
      key={action.id}
      armed={armedFor(action.id)}
      onClose={disarm}
      trigger={() => (
        <Button
          variant={isFilled ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => {
            if (action.confirm !== null) {
              setArmed({
                armed: { action, run: () => run({ actionId: action.id }) },
                origin: action.id,
              });
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
      )}
    />
  );

  return (
    <span data-testid="artifact-actions" className="flex min-w-0 shrink-0 items-center">
      <HeaderActions
        secondary={details}
        button={secondary === null ? null : buttonOf(secondary, false)}
        primary={primary === null ? null : buttonOf(primary, true)}
        overflow={
          actions.length > 0 ? (
            <ArmedActionPopover
              armed={armedFor(MENU_ORIGIN)}
              onClose={disarm}
              trigger={() => (
                <ArtifactOverflowMenu
                  target={target}
                  label="More"
                  size="control"
                  viewing={viewing}
                  onArm={(next) => setArmed({ armed: next, origin: MENU_ORIGIN })}
                />
              )}
            />
          ) : null
        }
      />
    </span>
  );
};
