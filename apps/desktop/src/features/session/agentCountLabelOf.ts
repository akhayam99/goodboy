import { countNoun } from '../../shared/utils/countNoun';
type Params = {
  readonly count: number;
};

export const agentCountLabelOf = ({ count }: Params): string => {
  if (count <= 0) {
    return '';
  }
  return `${countNoun({ count: count, one: 'agent' })}`;
};
