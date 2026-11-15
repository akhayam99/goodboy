import { AGENT_KIND_META, type AgentKind } from './agent-kind';

const PLACEHOLDER_NAME = /^agent \d+$/;

type Params = {
  readonly name: string;
  readonly kind: AgentKind;
};

export const isDefaultAgentName = ({ name, kind }: Params): boolean => {
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
