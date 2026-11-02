import { needsYouText } from '../../shared/utils/needsYouText';

type Params = {
  readonly count: number;
};

export const needYouWords = ({ count }: Params): string =>
  needsYouText({ count, unit: 'sessions' });
