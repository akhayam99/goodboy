import { StatusDot, type Tone } from '@goodboy/ui';

type Props = {
  readonly tone: Tone;
  readonly label: string;
  readonly isPulsing?: boolean;
};

export const StepStatus = ({ tone, label, isPulsing = false }: Props) => (
  <span className="flex shrink-0 items-center gap-2 text-meta whitespace-nowrap text-muted-foreground">
    <StatusDot
      tone={tone}
      size="sm"
      pulsing={isPulsing}
      className="motion-safe:transition-colors motion-safe:duration-200 motion-safe:ease-out"
    />
    <span key={label} className="motion-safe:animate-text-swap">
      {label}
    </span>
  </span>
);
