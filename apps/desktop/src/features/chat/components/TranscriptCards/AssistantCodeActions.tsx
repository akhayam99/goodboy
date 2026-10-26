import { useContext } from 'react';
import { Copy, SquareTerminal } from 'lucide-react';
import { Button, ICON_SIZE, useCopyLink, type CodeBlockActionsProps } from '@goodboy/ui';
import { RUN_IN_TERMINAL_LABEL, useRunInTerminal } from '../../hooks/useRunInTerminal';
import { shellCommandOf } from '../../utils/shellCommandOf';
import { CodeActionTargetContext } from './codeActionTarget';

export const AssistantCodeActions = ({ content, lang }: CodeBlockActionsProps) => {
  const { sessionId, workingDir } = useContext(CodeActionTargetContext);
  const { copiedKey, copy } = useCopyLink();
  const terminal = useRunInTerminal({ sessionId });
  const command = shellCommandOf({ lang, content });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void copy({ text: content, key: 'code' })}
        className="bg-background"
      >
        <Copy size={ICON_SIZE.row} aria-hidden />
        {copiedKey === 'code' ? 'Copied' : 'Copy'}
      </Button>
      {command !== null && terminal.canRun ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => terminal.run({ command, cwd: workingDir })}
          className="bg-background"
        >
          <SquareTerminal size={ICON_SIZE.row} aria-hidden />
          {RUN_IN_TERMINAL_LABEL}
        </Button>
      ) : null}
    </>
  );
};
