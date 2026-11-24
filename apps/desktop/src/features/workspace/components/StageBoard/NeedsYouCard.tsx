import { ArrowRight } from '@goodboy/ui/icons';
import { ICON_SIZE, InteractiveRow, ToneBar, TruncatedText, type Tone } from '@goodboy/ui';

type Props = {
  readonly sessionId: string;
  readonly title: string;
  readonly context: string;
  readonly reason: string;
  readonly meta: string;
  readonly tone: Tone;
  readonly onOpen: () => void;
};

export const NeedsYouCard = ({ sessionId, title, context, reason, meta, tone, onOpen }: Props) => (
  <InteractiveRow
    label={`Open ${title}, ${reason}`}
    isSelected={false}
    onOpen={onOpen}
    radius="lg"
    dataAttributes={{ 'data-needs-you-card': sessionId }}
    frameClassName="flex w-full flex-col border border-border-soft bg-elevated text-foreground shadow-sm"
    className="flex min-h-0 flex-1 flex-col gap-2 p-3 pl-4 text-left select-none"
  >
    <ToneBar tone={tone} density="card" />
    <span className="flex min-w-0 flex-col gap-0.5">
      {context === '' ? null : (
        <TruncatedText data-slot="card-context" className="text-meta text-muted-foreground">
          {context}
        </TruncatedText>
      )}
      <TruncatedText lines={2} className="text-row text-foreground">
        {title}
      </TruncatedText>
    </span>
    <TruncatedText lines={2} className="text-ui text-foreground">
      {reason}
    </TruncatedText>
    <span className="flex min-h-5 min-w-0 items-center gap-2 text-meta text-faint-foreground">
      <TruncatedText data-slot="card-facts" className="min-w-0 flex-1 tabular-nums">
        {meta}
      </TruncatedText>
      <ArrowRight size={ICON_SIZE.row} aria-hidden className="shrink-0" />
    </span>
  </InteractiveRow>
);
