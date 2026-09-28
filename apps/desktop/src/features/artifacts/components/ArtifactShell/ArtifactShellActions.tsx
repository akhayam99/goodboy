import { Ellipsis } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import type { ArtifactActionTarget, ResolvedAction } from '../../../actions/types';

const HEADER_OMISSIONS: ReadonlyArray<string> = ['artifact.open'];

type Props = {
  readonly target: ArtifactActionTarget;
  readonly onArm: (params: {
    readonly action: ResolvedAction;
    readonly run: () => Promise<void>;
  }) => void;
};

const EMPHASIS_ORDER = { secondary: 0, primary: 1 } as const;

export const ArtifactShellActions = ({ target, onArm }: Props) => {
  const env = useActionEnv({ origin: 'button' });
  const { actions, run } = useObjectActions({ target, env });
  const buttons = actions
    .filter((action) => action.emphasis !== null)
    .slice()
    .sort(
      (left, right) =>
        EMPHASIS_ORDER[left.emphasis ?? 'secondary'] -
        EMPHASIS_ORDER[right.emphasis ?? 'secondary'],
    );
  const omit = [...HEADER_OMISSIONS, ...buttons.map((action) => action.id)];
  const hasOverflow = actions.some((action) => !omit.includes(action.id));

  return (
    <span data-testid="artifact-actions" className="flex min-w-0 shrink-0 items-center gap-1.5">
      {buttons.map((action) => (
        <Button
          key={action.id}
          variant={action.emphasis === 'primary' ? 'primary' : 'secondary'}
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
      {hasOverflow ? (
        <ObjectOverflowMenu
          target={target}
          label="More"
          tooltip="More actions"
          trigger={<Ellipsis size={ICON_SIZE.control} aria-hidden />}
          triggerClassName="p-1.5"
          omit={omit}
        />
      ) : null}
    </span>
  );
};
