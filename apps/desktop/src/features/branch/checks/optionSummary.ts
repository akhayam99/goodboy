import { outsideFence } from './outsideFence';

type Params = {
  readonly body: string;
};

const LEADING_MARKERS = /^(?:[-*+>#]+\s+)+/;

export const optionSummary = ({ body }: Params): string => {
  const lines = body.split('\n');
  const isPlain = outsideFence({ lines });
  const first = lines.find((line, index) => isPlain[index] === true && line.trim().length > 0);
  return first === undefined ? '' : first.trim().replace(LEADING_MARKERS, '');
};
