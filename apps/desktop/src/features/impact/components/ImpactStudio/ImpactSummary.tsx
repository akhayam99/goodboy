import type { SummaryPart } from '../../utils/impactSummary';

type Props = {
  readonly parts: ReadonlyArray<SummaryPart>;
};

export const ImpactSummary = ({ parts }: Props) => (
  <p className="max-w-[680px] text-prose text-muted-foreground">
    {parts.map((part, index) =>
      part.isStrong ? (
        <strong key={index} className="text-foreground">
          {part.text}
        </strong>
      ) : (
        <span key={index}>{part.text}</span>
      ),
    )}
  </p>
);
