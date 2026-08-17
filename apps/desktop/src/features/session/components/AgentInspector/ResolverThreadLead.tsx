import { ClampedProse } from '@goodboy/ui';
import type { ResolverThreadBrief } from '../../resolverThreadBrief';

type Props = {
  readonly brief: ResolverThreadBrief;
};

const ROW_LABEL_CLASS = 'w-14 shrink-0 text-2xs uppercase tracking-wide text-muted-foreground/50';

const ROW_VALUE_CLASS = 'min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground';

export const ResolverThreadLead = ({ brief }: Props) => (
  <dl className="flex flex-col gap-1">
    {brief.ask !== '' && (
      <div className="flex min-w-0 gap-2">
        <dt className={ROW_LABEL_CLASS}>Ask</dt>
        <dd className={ROW_VALUE_CLASS}>
          <ClampedProse text={brief.ask} lines={3} className="text-xs leading-relaxed" />
        </dd>
      </div>
    )}
    <div className="flex min-w-0 gap-2">
      <dt className={ROW_LABEL_CLASS}>Verdict</dt>
      <dd className={ROW_VALUE_CLASS}>
        <ClampedProse text={brief.verdict} lines={3} className="text-xs leading-relaxed" />
      </dd>
    </div>
    <div className="flex min-w-0 gap-2">
      <dt className={ROW_LABEL_CLASS}>Next</dt>
      <dd className="min-w-0 flex-1 text-xs leading-relaxed text-foreground/80">{brief.next}</dd>
    </div>
  </dl>
);
