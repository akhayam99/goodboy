import { cn } from '@goodboy/ui';
import { SummaryText } from './SummaryText';

const SUB_BULLET = /^[-*+][ \t]+/;

type Props = {
  readonly item: string;
  readonly className?: string;
};

export const SummaryLine = ({ item, className }: Props) => {
  const [first = '', ...subs] = item.split('\n');
  return (
    <span
      className={cn('flex min-w-0 max-w-170 flex-col gap-0.5 [overflow-wrap:anywhere]', className)}
    >
      <span>
        <SummaryText text={first} />
      </span>
      {subs.map((sub, index) => (
        <span key={`${index}-${sub}`} className="text-ui text-muted-foreground">
          <SummaryText text={sub.replace(SUB_BULLET, '')} />
        </span>
      ))}
    </span>
  );
};
