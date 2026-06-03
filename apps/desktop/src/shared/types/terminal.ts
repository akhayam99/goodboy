import type { SessionId } from '@goodboy/types';

export type TerminalTabId = string & { readonly __brand: 'TerminalTabId' };

export type TerminalTabStatus = 'running' | 'exited' | 'attention';

export interface TerminalTab {
  readonly id: TerminalTabId;
  readonly sessionId: SessionId;
  readonly title: string;
  readonly cwd: string | null;
  readonly status: TerminalTabStatus;
  readonly createdAt: number;
}
