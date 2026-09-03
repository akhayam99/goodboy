import type { ReactNode } from 'react';
import { Collapsible } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly count: number;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly children: ReactNode;
};

export const UserScriptGroup = ({ label, count, open, onOpenChange, children }: Props) => (
  <Collapsible
    open={open}
    onOpenChange={onOpenChange}
    className="border border-border-soft"
    trigger={
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-medium">{label}</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-3xs tabular-nums text-muted-foreground">
          {count}
        </span>
      </span>
    }
  >
    {children}
  </Collapsible>
);
