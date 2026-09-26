import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly glyph?: ReactNode;
  readonly title: string;
  readonly meta: string;
  readonly actions?: ReactNode;
  readonly onBack: () => void;
};

export const SpendAnchorTitle = ({ glyph, title, meta, actions, onBack }: Props) => (
  <div className="flex flex-col gap-2">
    <div className="flex">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft size={ICON_SIZE.control} aria-hidden />
        All spend
      </Button>
    </div>
    <div className="flex min-w-0 items-center gap-3">
      {glyph ?? null}
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="truncate text-heading text-foreground">{title}</h2>
        <span className="text-label text-muted-foreground">{meta}</span>
      </div>
      {actions ?? null}
    </div>
  </div>
);
