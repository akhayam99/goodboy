import { Info } from 'lucide-react';

interface Props {
  readonly text: string;
}

// Renders a single-line explainer above the CTA. Goal: never surprise the
// user with what they are about to run.
export function InfoBanner({ text }: Props) {
  return (
    <div className="flex items-start gap-1.5 text-2xs text-muted-foreground">
      <Info size={11} aria-hidden className="mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
