import { TEXT_ROLE, cn } from '@goodboy/ui';
import { AgentsGridSpecimen } from './AgentsGridSpecimen';

export const TypeSpecimen = () => (
  <article className="flex flex-col gap-4">
    <h1 className={cn('text-lead', TEXT_ROLE.label)}>Ledger export speed up</h1>
    <p className={cn('text-prose', TEXT_ROLE.label)}>
      Stream ledger rows to CSV so an export of 10k rows ends before the payments-api timeout.
    </p>
    <section className="flex flex-col gap-2" aria-label="Agents">
      <h2 className={cn('text-row', TEXT_ROLE.secondary)}>Agents</h2>
      <AgentsGridSpecimen />
    </section>
  </article>
);
