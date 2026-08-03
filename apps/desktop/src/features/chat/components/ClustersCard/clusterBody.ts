import { outputPreview } from '../../../../shared/utils/outputPreview';

type ClusterAgent = {
  readonly status: string;
  readonly outputSummary?: string | null;
};

type Params = {
  readonly agent: ClusterAgent | null;
  readonly instructions: string | null;
};

export const clusterBody = ({ agent, instructions }: Params): string => {
  const fallback = instructions ?? '';
  if (agent == null || agent.status !== 'completed') {
    return fallback;
  }
  const preview = outputPreview({ text: agent.outputSummary });
  if (preview === '') {
    return fallback;
  }
  return preview;
};
