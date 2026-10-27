import { Copy, SquareTerminal } from 'lucide-react';
import { Button, ICON_SIZE, useCopyLink } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useHandOutputToAgent } from '../../../../shared/hooks/useHandOutputToAgent';
import { RUN_IN_TERMINAL_LABEL, useRunInTerminal } from '../../hooks/useRunInTerminal';
import { commandSubjectOf, type CommandTool } from '../../utils/commandToolOf';

type Props = {
  readonly tool: CommandTool;
  readonly isError: boolean;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
  readonly workingDir: string | null;
};

const ASK_OUTPUT_LABEL = 'Ask about this output';

export const CommandVerbs = ({ tool, isError, sessionId, agentId, workingDir }: Props) => {
  const { copiedKey, copy } = useCopyLink();
  const terminal = useRunInTerminal({ sessionId });
  const handOutput = useHandOutputToAgent({ sessionId, agentId });
  const output = tool.output ?? '';
  const hasOutput = output.trim() !== '';
  const outcome = tool.exitCode === null ? (isError ? 'Failed' : null) : `Exit ${tool.exitCode}`;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void copy({ text: tool.command, key: 'command' })}
      >
        <Copy size={ICON_SIZE.row} aria-hidden />
        {copiedKey === 'command' ? 'Copied' : 'Copy command'}
      </Button>
      {tool.output === null ? null : (
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasOutput}
          onClick={() => void copy({ text: output, key: 'output' })}
        >
          <Copy size={ICON_SIZE.row} aria-hidden />
          {copiedKey === 'output' ? 'Copied' : 'Copy output'}
        </Button>
      )}
      {terminal.canRun ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => terminal.run({ command: tool.command, cwd: workingDir })}
        >
          <SquareTerminal size={ICON_SIZE.row} aria-hidden />
          {RUN_IN_TERMINAL_LABEL}
        </Button>
      ) : null}
      {handOutput.canHandOff && tool.output !== null ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={!hasOutput}
          onClick={() =>
            handOutput.handOff({
              subject: commandSubjectOf({ command: tool.command }),
              outcome,
              projectName: null,
              branch: null,
              output: `$ ${tool.command}\n\n${output}`,
            })
          }
        >
          <CONCEPT_ICONS.agents size={ICON_SIZE.row} aria-hidden />
          {ASK_OUTPUT_LABEL}
        </Button>
      ) : null}
    </div>
  );
};
