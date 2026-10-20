import type { Fact, FactCardSpec } from '@goodboy/ui';
import { routingLabelModel } from '../../../shared/components/RoutingLabel/routingLabelModel';
import { factStateToneOf } from '../../../shared/utils/factStateToneOf';
import type { RailRow } from './railRowsOf';

type Params = {
  readonly row: RailRow;
};

export const railRowCardOf = ({ row }: Params): FactCardSpec => {
  const routing = routingLabelModel({
    provider: row.provider,
    model: row.model,
    effort: row.effort,
    planned: null,
    isEffortObserved: false,
  });
  const facts: Array<Fact> = [
    ...(row.task === null ? [] : [{ label: 'Task', value: row.task }]),
    ...(routing.card?.facts ?? []),
  ];
  return {
    title: row.label,
    state: { tone: factStateToneOf({ tone: row.tone }), words: row.word },
    facts,
  };
};
