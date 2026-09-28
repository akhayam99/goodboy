import type { MarkedSegment } from '@goodboy/types';

type Props = {
  readonly segments: ReadonlyArray<MarkedSegment>;
};

export const MarkedText = ({ segments }: Props) => (
  <>
    {segments.map((segment, index) =>
      segment.isMatch ? (
        <mark key={index} className="rounded-sm bg-find-match text-foreground">
          {segment.text}
        </mark>
      ) : (
        <span key={index}>{segment.text}</span>
      ),
    )}
  </>
);
