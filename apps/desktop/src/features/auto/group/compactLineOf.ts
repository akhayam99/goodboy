import type { AutoGroup } from '../autoGroupOf';
import { joinNouns } from '../joinNouns';

type Params = {
  readonly group: AutoGroup;
};

export const compactLineOf = ({ group }: Params): string => {
  const children = group.children.filter((child) => child.state !== 'retried');
  const only = children.length === 1 ? children[0] : undefined;
  if (only?.outcome !== undefined && only.outcome !== null) {
    return only.outcome;
  }
  if (children.length === 0) {
    return group.word;
  }
  const nouns = children.map((child) => child.noun);
  return `${children.length} agents finished: ${joinNouns({ nouns })}`;
};
