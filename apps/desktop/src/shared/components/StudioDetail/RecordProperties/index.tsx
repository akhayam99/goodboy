import type { ResolvedFact } from '../../../detail-fields/factTypes';
import { PropertyRow } from './PropertyRow';

type Props = {
  readonly facts: ReadonlyArray<ResolvedFact>;
};

export const RecordProperties = ({ facts }: Props) => {
  if (facts.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Properties" data-slot="record-properties" className="flex min-w-0 flex-col">
      {facts.map((fact) => (
        <li key={`${fact.slot}-${fact.key}`} data-fact-slot={fact.slot} className="min-w-0">
          <PropertyRow fact={fact} />
        </li>
      ))}
    </ul>
  );
};
