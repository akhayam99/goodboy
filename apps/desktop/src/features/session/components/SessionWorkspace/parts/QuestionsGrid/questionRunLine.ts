import { AGENT_KIND_META, type AgentKind } from '../../../../agent-kind';

type Params = {
  readonly askerKind: AgentKind | null;
  readonly runName: string | null;
};

export const questionRunLine = ({ askerKind, runName }: Params): string => {
  const noun = askerKind === null ? '' : AGENT_KIND_META[askerKind].noun;
  const name = (runName ?? '').trim();
  const isSameWord = name.toLowerCase() === noun.toLowerCase();
  return [noun, isSameWord ? '' : name].filter((part) => part !== '').join(' · ');
};
