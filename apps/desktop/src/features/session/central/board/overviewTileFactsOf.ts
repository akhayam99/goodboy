import type { Agent, OpenQuestion, PlanWithCount, SessionArtifact } from '@goodboy/types';
import { liveArtifactCountOf } from '../../../artifacts/liveArtifactCountOf';
import { selectOpenQuestions } from '../../components/SessionOverviewPane/lib';

export type OverviewTileFacts = Readonly<{
  openQuestions: number;
  blockingQuestions: number;
  artifacts: number;
  newestArtifactAt: number | null;
}>;

type Params = {
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly agents: ReadonlyArray<Agent>;
};

type NewestParams = {
  readonly stamps: ReadonlyArray<string>;
};

const newestOf = ({ stamps }: NewestParams): number | null => {
  const times = stamps.map((stamp) => Date.parse(stamp)).filter((time) => Number.isFinite(time));
  return times.length === 0 ? null : Math.max(...times);
};

export const overviewTileFactsOf = ({
  questions,
  plans,
  artifacts,
  agents,
}: Params): OverviewTileFacts => {
  const open = selectOpenQuestions(questions);
  const live = [...plans, ...artifacts].filter((item) => item.status !== 'discarded');
  return {
    openQuestions: open.length,
    blockingQuestions: open.filter((question) => question.isBlocking).length,
    artifacts: liveArtifactCountOf({ plans, artifacts, agents }),
    newestArtifactAt: newestOf({ stamps: live.map((item) => item.updatedAt) }),
  };
};
