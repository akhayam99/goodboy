import { cn } from '../cn';
import { midTruncate } from '../midTruncate';
import { Tooltip } from './Tooltip';

type Props = {
  readonly name: string;
  readonly className?: string;
};

export const MidTruncate = ({ name, className }: Props) => {
  const { head, tail } = midTruncate({ name });
  const text = (
    <span className={cn('flex min-w-0 max-w-full', className)}>
      <span className="sr-only">{name}</span>
      <span aria-hidden className="min-w-0 truncate">
        {head}
      </span>
      {tail === '' ? null : (
        <span aria-hidden className="shrink-0 whitespace-pre">
          {tail}
        </span>
      )}
    </span>
  );
  if (tail === '') {
    return text;
  }
  return (
    <Tooltip content={name} anchorClassName="min-w-0">
      {text}
    </Tooltip>
  );
};
