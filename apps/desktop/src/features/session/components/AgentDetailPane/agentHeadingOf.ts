import { AGENT_KIND_META, type AgentKind } from '../../agent-kind';

const PLACEHOLDER_NAME = /^agent \d+$/;

type DefaultParams = {
  readonly name: string;
  readonly kind: AgentKind;
};

const isDefaultAgentName = ({ name, kind }: DefaultParams): boolean => {
  const trimmed = name.trim();
  const meta = AGENT_KIND_META[kind];
  return (
    trimmed === '' ||
    trimmed === meta.noun ||
    trimmed === meta.label ||
    trimmed === 'Auto' ||
    PLACEHOLDER_NAME.test(trimmed)
  );
};

type Params = DefaultParams & {
  readonly brief: string | null;
};

export const agentHeadingOf = ({ name, kind, brief }: Params): string => {
  if (!isDefaultAgentName({ name, kind }) || brief === null) {
    return name;
  }
  return brief;
};
