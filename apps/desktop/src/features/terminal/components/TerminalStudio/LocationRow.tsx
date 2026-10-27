import { Folder } from 'lucide-react';
import { ICON_SIZE } from '@goodboy/ui';
import { PathLine } from '../PathLine';

type Props = {
  readonly cwd: string;
};

export const LocationRow = ({ cwd }: Props) => (
  <div className="flex h-8 shrink-0 items-center gap-2 px-3">
    <Folder size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
    <PathLine path={cwd} />
  </div>
);
