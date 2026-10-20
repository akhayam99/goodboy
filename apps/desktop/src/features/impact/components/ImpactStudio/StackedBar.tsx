import { FactCard, cn, tintClasses, type Tone } from '@goodboy/ui';

type StackedSegment = {
  readonly key: string;
  readonly tone: Tone;
  readonly share: number;
  readonly label: string;
  readonly value: string;
};

type Props = {
  readonly heading: string;
  readonly segments: ReadonlyArray<StackedSegment>;
  readonly className?: string;
};

export const StackedBar = ({ heading, segments, className }: Props) => {
  const visible = segments.filter((segment) => segment.share > 0);
  if (visible.length === 0) {
    return <div className={cn('h-2 w-full rounded-full bg-muted', className)} aria-hidden />;
  }

  return (
    <FactCard
      card={{
        title: heading,
        facts: segments.map((segment) => ({
          label: segment.label,
          value: segment.value,
          note: `${Math.round(segment.share)}%`,
        })),
      }}
    >
      <div className={cn('flex h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
        {visible.map((segment) => (
          <div
            key={segment.key}
            style={{ width: `${segment.share}%` }}
            className={cn('h-full', tintClasses(segment.tone).dot)}
          />
        ))}
      </div>
    </FactCard>
  );
};
