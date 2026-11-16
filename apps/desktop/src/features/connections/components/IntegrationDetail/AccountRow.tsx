import type { ReactNode } from 'react';
import { BandRow } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly primary: string;
  readonly secondary: ReactNode;
  readonly action?: ReactNode;
};

export const AccountRow = ({ label, primary, secondary, action }: Props) => (
  <BandRow>
    <span className="w-32 shrink-0 text-ui text-muted-foreground">{label}</span>
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-ui text-foreground">{primary}</span>
      <span className="truncate text-meta text-muted-foreground">{secondary}</span>
    </span>
    {action ?? null}
  </BandRow>
);
