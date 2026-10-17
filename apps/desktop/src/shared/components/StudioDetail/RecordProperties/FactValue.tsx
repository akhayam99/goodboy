import { Tooltip } from '@goodboy/ui';
import type { ResolvedFact } from '../../../detail-fields/factTypes';

type Props = {
  readonly fact: ResolvedFact;
};

export const FactValue = ({ fact }: Props) =>
  fact.hint == null ? (
    <span className="min-w-0">{fact.node}</span>
  ) : (
    <Tooltip content={fact.hint}>
      <span className="min-w-0">{fact.node}</span>
    </Tooltip>
  );
