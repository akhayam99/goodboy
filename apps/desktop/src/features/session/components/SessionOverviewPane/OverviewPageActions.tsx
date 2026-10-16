import { Button } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import { useIsBranchlessSession } from '../../hooks/useIsBranchlessSession';
import { openLens } from '../../openLens';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';

type Props = {
  readonly session: Session;
};

const WRITE_KEY = 'write-from-work';

export const OverviewPageActions = ({ session }: Props) => {
  const sessionId = session.id;
  const env = useActionEnv({ origin: 'menu' });
  const object = useObjectActions({ target: { kind: 'session', sessionId }, env });
  const isBranchless = useIsBranchlessSession({ session });
  const pending = usePendingAction({ sessionId });
  const writeAction = object.actions.find((action) => action.id === 'session.writeFromWork');
  return (
    <>
      {writeAction === undefined ? null : (
        <Button
          variant="quiet"
          size="sm"
          isBusy={pending.pendingKeys.has(WRITE_KEY)}
          onClick={() =>
            void pending.run({
              key: WRITE_KEY,
              failureTitle: "Couldn't write the title and goal",
              task: () => object.run({ actionId: writeAction.id }),
            })
          }
        >
          {writeAction.label}
        </Button>
      )}
      {isBranchless ? (
        <Button variant="quiet" size="sm" onClick={() => openLens({ sessionId, lens: 'scripts' })}>
          Scripts
        </Button>
      ) : null}
    </>
  );
};
