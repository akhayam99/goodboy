import { ArrowRight } from '@goodboy/ui/icons';
import { cn, ICON_SIZE, ToneBar, TruncatedText, type Tone } from '@goodboy/ui';
import { sessionCardShell } from '../../../session/components/sessionCardShell';

type Props = {
  readonly sessionId: string;
  readonly title: string;
  readonly project: string;
  readonly reason: string;
  readonly meta: string;
  readonly tone: Tone;
  readonly laneRem: number;
  readonly onOpen: () => void;
};

export const NeedsYouCard = ({
  sessionId,
  title,
  project,
  reason,
  meta,
  tone,
  laneRem,
  onOpen,
}: Props) => (
  <button
    type="button"
    data-needs-you-card={sessionId}
    aria-label={`Open ${title}, ${reason}`}
    style={{ width: `${laneRem}rem` }}
    onClick={onOpen}
    className={cn(
      'flex shrink-0 cursor-pointer flex-col gap-1 p-3 pl-5 text-left select-none',
      sessionCardShell({}),
    )}
  >
    <ToneBar tone={tone} density="card" />
    <TruncatedText className="text-meta text-muted-foreground">{project}</TruncatedText>
    <TruncatedText className="text-row text-foreground">{title}</TruncatedText>
    <TruncatedText lines={2} className="min-h-10 text-ui text-foreground">
      {reason}
    </TruncatedText>
    <span className="flex min-w-0 items-center gap-2 text-meta text-muted-foreground">
      <TruncatedText className="min-w-0 flex-1">{meta}</TruncatedText>
      <ArrowRight size={ICON_SIZE.row} aria-hidden className="shrink-0" />
    </span>
  </button>
);
