import { FACT_SLOTS, type Fact, type FactRegistry, type ResolvedFact } from './factTypes';
import { isPresentNode } from './isPresentNode';

type Params<T> = {
  readonly registry: FactRegistry<T>;
  readonly entity: T;
};

type AsListParams = {
  readonly value: ReadonlyArray<Fact> | Fact | null;
};

const asList = ({ value }: AsListParams): ReadonlyArray<Fact> => {
  if (value == null) {
    return [];
  }
  if ('node' in value) {
    return [value];
  }
  return value;
};

export const resolveFacts = <T>({ registry, entity }: Params<T>): ReadonlyArray<ResolvedFact> =>
  FACT_SLOTS.flatMap((slot) => {
    const resolver = registry[slot];
    if (resolver === undefined) {
      return [];
    }
    return asList({ value: resolver({ entity }) })
      .filter((fact) => isPresentNode({ node: fact.node }))
      .map((fact) => ({ ...fact, slot }));
  });
