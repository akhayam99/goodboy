import type { ExecutedAgentRouting } from '../../store/slices/turn/executedAgentRouting';

export type ShownRouting = Readonly<{
  provider: string | null;
  model: string | null;
  effort: string | null;
}>;

type Params = {
  readonly executed: ExecutedAgentRouting | null;
  readonly fallback: ShownRouting;
};

export const executedRoutingOf = ({ executed, fallback }: Params): ShownRouting => {
  if (executed === null) {
    return fallback;
  }
  return {
    provider: executed.provider,
    model: executed.model,
    effort: executed.effort ?? fallback.effort,
  };
};
