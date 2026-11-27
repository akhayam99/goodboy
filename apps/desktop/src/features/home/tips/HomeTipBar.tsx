import { FieldError, ICON_SIZE, IconButton } from '@goodboy/ui';
import { Lightbulb, X } from '@goodboy/ui/icons';
import type { HomeTip, TipDismiss } from './homeTips';

type Props = {
  readonly tip: HomeTip;
  readonly isFailed: boolean;
  readonly onDismiss: (params: TipDismiss) => void;
};

export const HomeTipBar = ({ tip, isFailed, onDismiss }: Props) => (
  <section
    aria-label="Tip"
    data-home-tip={tip.id}
    className="flex items-start gap-3 rounded-lg bg-subtle px-3 py-2"
  >
    <Lightbulb size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <p className="text-meta text-muted-foreground">{tip.text}</p>
      {isFailed ? (
        <FieldError id="home-tip-error" error="Couldn't close this tip. Try closing it again." />
      ) : null}
    </div>
    <IconButton icon={X} size="xs" label="Close tip" onClick={() => onDismiss({ tipId: tip.id })} />
  </section>
);
