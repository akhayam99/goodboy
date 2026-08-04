import { GhostActionButton } from '../../../../shared/components/GhostActionButton';
import { RESOLVER_ACTION_BUSY_LABEL } from '../../resolverActionBusyLabel';
import { RESOLVER_ACTION_ICON } from '../../resolverActionIcon';
import type { ResolverMissingVerdicts } from '../../resolverMissingVerdicts';

type Props = {
  readonly missing: ResolverMissingVerdicts;
  readonly isBusy: boolean;
  readonly onAsk: () => void;
};

export const ResolverMissingVerdictsNotice = ({ missing, isBusy, onAsk }: Props) => (
  <div
    data-testid="resolver-missing-verdicts"
    className="flex flex-col gap-1.5 rounded-md bg-warning/10 p-3"
  >
    <p className="text-2xs leading-relaxed text-warning">{missing.sentence}</p>
    <div className="flex justify-end">
      <GhostActionButton
        icon={RESOLVER_ACTION_ICON.verdict}
        label={missing.actionLabel}
        tone="warning"
        highlighted
        isBusy={isBusy}
        busyLabel={RESOLVER_ACTION_BUSY_LABEL.verdict}
        onClick={onAsk}
      />
    </div>
  </div>
);
