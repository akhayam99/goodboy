import type { ReactNode } from 'react';
import type { SessionId } from '@goodboy/types';
import { PortChip } from '../PortChip';
import { LocationRow } from './LocationRow';

type Props = {
  readonly cwd: string | null;
  readonly ports: ReadonlyArray<number>;
  readonly sessionId: SessionId | null;
  readonly folderAction?: ReactNode;
  readonly actions?: ReactNode;
};

export const TerminalToolbar = ({
  cwd,
  ports,
  sessionId,
  folderAction = null,
  actions = null,
}: Props) => (
  <div data-grid-row="1" className="flex h-10 shrink-0 items-center gap-2 px-3">
    {cwd === null ? null : <LocationRow cwd={cwd} />}
    <span className="flex-1" />
    <div className="flex shrink-0 items-center gap-1">
      {folderAction}
      {ports.map((port) => (
        <PortChip key={port} port={port} sessionId={sessionId} />
      ))}
      {actions}
    </div>
  </div>
);
