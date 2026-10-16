import { useContext } from 'react';
import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type { ResolvedFact } from '../../../detail-fields/factTypes';
import { RecordFrameContext } from '../RecordFrameContext';
import { propertyGroupsOf } from './propertyGroupsOf';
import { PropertyRow } from './PropertyRow';

type Props = {
  readonly facts: ReadonlyArray<ResolvedFact>;
};

const NO_LINK_FACTS: ReadonlyArray<ResolvedFact> = [];

export const RecordProperties = ({ facts }: Props) => {
  const linkFacts = useContext(RecordFrameContext)?.linkFacts ?? NO_LINK_FACTS;
  const groups = propertyGroupsOf({ facts: [...facts, ...linkFacts] });
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
