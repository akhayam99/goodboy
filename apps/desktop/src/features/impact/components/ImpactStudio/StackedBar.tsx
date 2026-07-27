import { cn, tintClasses, type Tone } from '@goodboy/ui';

type StackedSegment = {
  readonly key: string;
  readonly tone: Tone;
  readonly share: number;
  readonly title: string;
};

type Props = {
  readonly segments: ReadonlyArray<StackedSegment>;
  readonly className?: string;
};

export const StackedBar = ({ segments, className }: Props) => {
  const visible = segments.filter((segment) => segment.share > 0);
  if (visible.length === 0) {
    return <div className={cn('h-2 w-full rounded-full bg-muted', className)} aria-hidden />;
  }

  return (
    <div className={cn('flex h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      {visible.map((segment) => (
        <div
          key={segment.key}
          title={segment.title}
          style={{ width: `${segment.share}%` }}
          className={cn('h-full', tintClasses(segment.tone).dot)}
        />
      ))}
    </div>
  );
};
