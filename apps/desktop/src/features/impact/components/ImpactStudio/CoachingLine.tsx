import { cn, StatusDot, tintClasses } from '@goodboy/ui';

type Props = {
  readonly message: string;
};

export const CoachingLine = ({ message }: Props) => (
  <div className={cn('flex items-center gap-2 rounded-md px-2 py-1.5', tintClasses('warning').bg)}>
    <StatusDot tone="warning" size="sm" />
    <span className="text-2xs leading-relaxed text-muted-foreground">{message}</span>
  </div>
);
