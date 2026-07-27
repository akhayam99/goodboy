import { ArrowUpRight, MessageSquareReply } from 'lucide-react';

const TILE_CLASS =
  'inline-flex items-center justify-center gap-1 self-center rounded-lg bg-foreground/[0.04] px-3 py-1.5 text-xs font-medium text-foreground ring-1 ring-border-soft transition-colors hover:bg-foreground/[0.08]';
const LINK_CLASS =
  'inline-flex items-center gap-1 self-start rounded-md px-2 py-0.5 text-2xs font-medium text-muted-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground';

type Props = {
  readonly variant: 'tile' | 'link';
  readonly onOpen: () => void;
};

export const ResolveCommentsAction = ({ variant, onOpen }: Props) => (
  <button type="button" onClick={onOpen} className={variant === 'tile' ? TILE_CLASS : LINK_CLASS}>
    {variant === 'link' && <MessageSquareReply size={11} aria-hidden />}
    Resolve comments
    <ArrowUpRight size={variant === 'tile' ? 13 : 10} aria-hidden className="shrink-0 opacity-70" />
  </button>
);
