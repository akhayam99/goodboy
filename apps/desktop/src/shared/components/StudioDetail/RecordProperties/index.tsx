import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type { ResolvedFact } from '../../../detail-fields/factTypes';
import { propertyGroupsOf } from './propertyGroupsOf';
import { PropertyRow } from './PropertyRow';

type Props = {
  readonly facts: ReadonlyArray<ResolvedFact>;
};

export const RecordProperties = ({ facts }: Props) => {
  const groups = propertyGroupsOf({ facts });
  if (groups.length === 0) {
    return null;
  }
  return (
    <div
      role="group"
      aria-label="Properties"
      data-slot="record-properties"
      className={cn('flex min-w-0 flex-col', PANE_RHYTHM.property.groupGap)}
    >
      {groups.map((group) => (
        <section key={group.name} aria-label={group.name} className={PANE_RHYTHM.property.group}>
          <h2 className="flex h-7 items-center pl-2 text-row text-muted-foreground">
            {group.name}
          </h2>
          <dl className={PANE_RHYTHM.property.grid}>
            {group.rows.map((row) => (
              <PropertyRow key={row.key} row={row} />
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
};
