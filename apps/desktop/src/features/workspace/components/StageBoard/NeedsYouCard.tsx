import { ArrowRight } from '@goodboy/ui/icons';
import { ICON_SIZE, InteractiveRow, ToneBar, TruncatedText, type Tone } from '@goodboy/ui';

type Props = {
  readonly sessionId: string;
  readonly title: string;
  readonly project: string;
  readonly reason: string;
  readonly meta: string;
  readonly tone: Tone;
  readonly onOpen: () => void;
};

export const NeedsYouCard = ({ sessionId, title, project, reason, meta, tone, onOpen }: Props) => (
  <InteractiveRow
    label={`Open ${title}, ${reason}`}
    isSelected={false}
    onOpen={onOpen}
    radius="lg"
    dataAttributes={{ 'data-needs-you-card': sessionId }}
    frameClassName="w-full border border-border-soft bg-elevated text-foreground"
    className="flex flex-col gap-1 p-3 pl-4 text-left select-none"
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
  </InteractiveRow>
);
