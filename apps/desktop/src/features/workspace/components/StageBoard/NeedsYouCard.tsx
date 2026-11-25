import { ArrowRight } from '@goodboy/ui/icons';
import { ICON_SIZE, InteractiveRow, ToneBar, TruncatedText } from '@goodboy/ui';

type Props = {
  readonly sessionId: string;
  readonly title: string;
  readonly context: string;
  readonly reason: string;
  readonly meta: string;
  readonly onOpen: () => void;
};

export const NeedsYouCard = ({ sessionId, title, context, reason, meta, onOpen }: Props) => (
  <InteractiveRow
    label={`Open ${title}, ${reason}`}
    isSelected={false}
    onOpen={onOpen}
    radius="lg"
    dataAttributes={{ 'data-needs-you-card': sessionId }}
    frameClassName="flex w-full shrink-0 flex-col border border-border-soft bg-elevated text-foreground shadow-sm hover:border-border"
    className="flex min-h-0 flex-1 flex-col gap-2 p-3 pl-5 text-left select-none"
  >
    <ToneBar tone="warning" density="card" />
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
    <span className="flex min-h-5 min-w-0 items-start gap-2 text-meta text-faint-foreground">
      <TruncatedText data-slot="card-facts" lines={2} className="min-w-0 flex-1 tabular-nums">
        {meta}
      </TruncatedText>
      <span className="flex h-5 shrink-0 items-center">
        <ArrowRight size={ICON_SIZE.row} aria-hidden />
      </span>
    </span>
  </InteractiveRow>
);
