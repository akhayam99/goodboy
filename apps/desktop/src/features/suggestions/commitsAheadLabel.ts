import { countNoun } from '../../shared/utils/countNoun';
type Params = {
  readonly ahead: number;
};

export const commitsAheadLabel = ({ ahead }: Params): string =>
  `${countNoun({ count: ahead, one: 'commit' })} ahead`;
