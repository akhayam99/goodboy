import { Button } from '@goodboy/ui';
import { actionIntentOf } from '../../../../actions/actionIntentOf';
import { forcePushConfirm } from '../../../../actions/kinds/gitRuns';
import { RebaseOriginCommits } from '../../../../../shared/components/RebaseOriginCommits';
import { countNoun } from '../../../../../shared/utils/countNoun';
import { NAMES } from '../../../../../shared/utils/names';
import type { BranchOriginCheck } from '../../../../../store/slices/history/types';
import type { OriginRecheckPhase } from './useOriginRecheck';

type Props = {
  readonly check: BranchOriginCheck;
  readonly phase: OriginRecheckPhase;
  readonly onForcePush: () => void;
  readonly onRebase: () => void;
};

type AskParams = {
  readonly count: number;
};

const askOf = ({ count }: AskParams): string =>
  count === 0
    ? 'Origin has no commits this branch lacks. Nothing there is lost.'
    : `Origin has ${countNoun({ count, one: 'commit', many: 'commits' })} this branch lacks. Force push drops them, a rebase keeps them.`;

export const OriginCheckAsk = ({ check, phase, onForcePush, onRebase }: Props) => {
  const count = check.onlyOnline.length;
  const isBusy = phase !== 'idle';
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <p className="text-meta text-foreground">{askOf({ count })}</p>
      <RebaseOriginCommits commits={check.onlyOnline} />
      <div className="flex flex-wrap items-center gap-2">
        {count > 0 && (
          <Button
            size="sm"
            variant="secondary"
            intent={actionIntentOf({ verb: NAMES.rebaseOnThem })}
            isBusy={phase === 'rebasing'}
            disabled={isBusy}
            onClick={onRebase}
          >
            {NAMES.rebaseOnThem}
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          intent={actionIntentOf({ verb: 'force push' })}
          isBusy={phase === 'pushing'}
          disabled={isBusy}
          onClick={onForcePush}
        >
          {forcePushConfirm({ onlyOnline: check.onlyOnline }).confirmLabel}
        </Button>
      </div>
    </div>
  );
};
