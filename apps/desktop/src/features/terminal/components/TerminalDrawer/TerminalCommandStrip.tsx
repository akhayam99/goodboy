import { Button, Notice } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import type { TerminalCommandMove } from '../../terminalCommandMoveOf';
import { PathLine } from '../PathLine';

type Props = {
  readonly move: TerminalCommandMove;
  readonly label: string;
  readonly isPending: boolean;
  readonly isTyped: boolean;
  readonly failure: string | null;
  readonly onRun: () => void;
  readonly onNotNow: () => void;
};

export const TerminalCommandStrip = ({
  move,
  label,
  isPending,
  isTyped,
  failure,
  onRun,
  onNotNow,
}: Props) => {
  const { command } = move.payload;
  return (
    <Notice
      tone={failure === null ? 'info' : 'danger'}
      placement="inline"
      role="status"
      title={move.title}
      actions={
        <div className="flex items-center gap-2">
          {isTyped ? (
            <span className="text-meta text-muted-foreground">{NAMES.pressEnterToRun}</span>
          ) : (
            <Button variant="secondary" size="sm" isBusy={isPending} onClick={onRun}>
              {label}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onNotNow}>
            Not now
          </Button>
        </div>
      }
    >
      <div className="flex min-w-0 flex-col gap-1">
        <code className="whitespace-pre-wrap break-all font-mono text-code text-foreground">
          {command.text}
        </code>
        <PathLine path={command.cwd} />
        {failure === null ? null : (
          <p role="alert" className="text-meta text-danger">
            {failure}
          </p>
        )}
      </div>
    </Notice>
  );
};
