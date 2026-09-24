import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '../cn';

export type ActionTileProps = {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly isDisabled?: boolean;
  readonly testId?: string;
  readonly className?: string;
  readonly onClick: () => void;
};

type SentenceParams = Readonly<{
  text: string;
}>;

const withFullStop = ({ text }: SentenceParams): string =>
  /[.!?]$/.test(text) ? text : `${text}.`;

export const ActionTile = ({
  icon,
  title,
  description,
  isDisabled = false,
  testId,
  className,
  onClick,
}: ActionTileProps) => (
  <button
    type="button"
    disabled={isDisabled}
    data-testid={testId}
    onClick={onClick}
    className={cn(
      'group flex w-full items-center gap-2.5 rounded-lg border border-border-soft bg-elevated px-3 py-2.5 text-left text-foreground motion-safe:transition-colors',
      isDisabled ? 'cursor-not-allowed opacity-60' : 'hover:border-border',
      className,
    )}
  >
    <span className="flex shrink-0 items-center">{icon}</span>
    <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
      <span className="text-sm font-medium text-foreground">{title}</span>
      <span className="line-clamp-2 text-2xs text-muted-foreground">
        {withFullStop({ text: description })}
      </span>
    </span>
    {isDisabled ? null : (
      <ArrowRight
        size={14}
        aria-hidden
        className="shrink-0 text-faint-foreground motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
      />
    )}
  </button>
);
