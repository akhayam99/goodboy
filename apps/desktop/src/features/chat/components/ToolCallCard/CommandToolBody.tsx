import type { AgentId, SessionId } from '@goodboy/types';
import type { CommandTool } from '../../utils/commandToolOf';
import { CommandBlock } from './CommandBlock';
import { CommandOutput } from './CommandOutput';
import { CommandVerbs } from './CommandVerbs';

type Props = {
  readonly tool: CommandTool;
  readonly isError: boolean;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
  readonly workingDir: string | null;
};

export const CommandToolBody = ({ tool, isError, sessionId, agentId, workingDir }: Props) => (
  <div className="flex min-w-0 flex-col gap-2">
    <CommandBlock command={tool.command} />
    {tool.output === null ? null : <CommandOutput output={tool.output} exitCode={tool.exitCode} />}
    <CommandVerbs
      tool={tool}
      isError={isError}
      sessionId={sessionId}
      agentId={agentId}
      workingDir={workingDir}
    />
  </div>
);
