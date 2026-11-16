import { FOCUS_RING, Tooltip, cn } from '@goodboy/ui';
import { shortPathOf } from './shortPathOf';

const CODE_CLASS = 'text-code-row text-muted-foreground [overflow-wrap:anywhere]';

type Props = {
  readonly value: string;
};

export const SummaryCode = ({ value }: Props) => {
  const short = shortPathOf({ value });
  if (short === value) {
    return <code className={CODE_CLASS}>{value}</code>;
  }
  return (
    <Tooltip content={value}>
      <code tabIndex={0} data-short-path="" className={cn(CODE_CLASS, 'rounded-sm', FOCUS_RING)}>
        <span className="sr-only">{value}</span>
        <span aria-hidden>{short}</span>
      </code>
    </Tooltip>
  );
};
