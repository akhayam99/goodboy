import type { RunnableScript } from '../../buildSessionScripts';
import type { ScriptLiveFacts } from '../../scriptLiveFacts';
import type { ScriptRunRecord } from '../../scripts';
import type { ScriptActionTarget } from '../../../actions/types';

export type ScriptRowProps = {
  readonly script: RunnableScript;
  readonly record: ScriptRunRecord | null;
  readonly now: number;
  readonly isSelected: boolean;
  readonly blockedReason: string | null;
  readonly target: ScriptActionTarget;
  readonly isPinned: boolean;
  readonly expectedPort: number | null;
  readonly portHolder: string | null;
  readonly facts: ScriptLiveFacts | null;
  readonly onTogglePin: () => void;
  readonly onOpen: (script: RunnableScript) => void;
  readonly onRun: (script: RunnableScript) => void;
  readonly onStop: (script: RunnableScript) => void;
  readonly onRestart: (script: RunnableScript) => void;
};
