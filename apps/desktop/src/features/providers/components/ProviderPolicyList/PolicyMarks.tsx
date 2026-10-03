import type { ProviderPolicyState } from '@goodboy/types';
import { Checkbox } from '@goodboy/ui';
import type { PolicyRow } from '../../policy/policyRows';

type Props = {
  readonly row: PolicyRow;
  readonly onToggleMark: (mark: 'payAsYouGo' | 'keepAfterLimit') => void;
  readonly onState: (state: ProviderPolicyState) => void;
};

export const PolicyMarks = ({ row, onToggleMark, onState }: Props) => {
  const isPaidOn = row.payAsYouGo && row.state === 'on';
  return (
    <div className="flex flex-col gap-1.5 pb-2 pl-12 pr-2">
      <div className="flex flex-wrap items-center gap-4">
        <Checkbox
          label="Pay-as-you-go"
          checked={row.payAsYouGo}
          onChange={() => onToggleMark('payAsYouGo')}
        />
        <Checkbox
          label="Keep using after the limit"
          checked={row.keepAfterLimit}
          onChange={() => onToggleMark('keepAfterLimit')}
        />
      </div>
      {isPaidOn ? (
        <p className="text-secondary text-muted-foreground">
          Pay-as-you-go bills per use.{' '}
          <button
            type="button"
            onClick={() => onState('backup')}
            className="text-info underline-offset-2 hover:underline"
          >
            Set Backup only
          </button>
        </p>
      ) : (
        <p className="text-secondary text-faint-foreground">
          Pay-as-you-go is a note for you. Keep using after the limit keeps this provider in the
          order while it is at its limit.
        </p>
      )}
    </div>
  );
};
