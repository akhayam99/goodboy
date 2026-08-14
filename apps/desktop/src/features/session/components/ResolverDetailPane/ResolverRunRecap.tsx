import type { ResolverActionsController } from '../../hooks/useResolverActions';
import type { ResolverThreadTally } from '../../resolverThreadTally';
import { ResolverActionBlock } from '../ResolverActionBlock';

type Props = {
  readonly tally: ResolverThreadTally;
  readonly blockedBy: string | null;
  readonly actions: ResolverActionsController;
};

const groupsOf = ({
  tally,
}: {
  readonly tally: ResolverThreadTally;
}): ReadonlyArray<{ readonly label: string; readonly count: number }> =>
  [
    { label: 'Settled', count: tally.closable },
    { label: 'Waiting on you', count: tally.open },
    { label: 'Closed', count: tally.total - tally.closable - tally.open },
  ].filter(({ count }) => count > 0);

export const ResolverRunRecap = ({ tally, blockedBy, actions }: Props) => {
  const groups = groupsOf({ tally });

  return (
    <section data-testid="resolver-run-recap" className="flex flex-col gap-3">
      {groups.length > 0 && (
        <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          {groups.map(({ label, count }) => (
            <div key={label} className="flex items-baseline gap-1.5">
              <dd className="text-sm font-semibold tabular-nums text-foreground">{count}</dd>
              <dt className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</dt>
            </div>
          ))}
        </dl>
      )}
      {blockedBy !== null && <p className="text-2xs text-warning">Blocked: {blockedBy}</p>}
      <ResolverActionBlock actions={actions} />
    </section>
  );
};
