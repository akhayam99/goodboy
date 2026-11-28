import type { ReactNode } from 'react';
import { InteractiveRow, TruncatedText } from '@goodboy/ui';

type Props = {
  readonly lead: ReactNode;
  readonly title: string;
  readonly meta: string;
  readonly label: string;
  readonly onOpen: () => void;
  readonly trailing?: ReactNode;
};

export const WidgetRow = ({ lead, title, meta, label, onOpen, trailing }: Props) => (
  <li className="flex min-h-12 min-w-0 flex-1 items-center">
    <InteractiveRow
      label={label}
      isSelected={false}
      onOpen={onOpen}
      frameClassName="flex w-full min-w-0 items-center"
      className="flex min-w-0 flex-1 items-center gap-2 p-1 text-left"
    >
      <span className="flex size-4 shrink-0 items-center justify-center">{lead}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <TruncatedText className="text-row text-foreground">{title}</TruncatedText>
        <TruncatedText className="text-meta text-faint-foreground tabular-nums">
          {meta}
        </TruncatedText>
      </span>
      {trailing === undefined ? null : (
        <span className="flex shrink-0 items-center">{trailing}</span>
      )}
    </InteractiveRow>
  </li>
);
