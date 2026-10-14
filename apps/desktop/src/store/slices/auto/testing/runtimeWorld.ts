import type { AutoTree } from '@goodboy/db';
import { createAutoRuntime, type AutoRuntime } from '../createAutoRuntime';
import type { AgentCommand, ChildTurnEnded } from '../ports';
import { WORLD_TREE } from './autoWorld';
import { WORLD_GRANT } from './fakePorts';
import { addUserRow, endedTurn, makeDeliveryWorld, type DeliveryWorld } from './deliveryWorld';
import { makeFakePorts } from './fakePorts';
import { secondScheduler } from './autoWorld';

export type RuntimeWorld = Readonly<{
  state: DeliveryWorld;
  runtime: AutoRuntime;
  errors: Array<unknown>;
  treeId: AutoTree['id'];
}>;

type RuntimeWorldParams = {
  readonly agentIds?: ReadonlyArray<string>;
  readonly planIds?: ReadonlyArray<Readonly<{ id: string; agentId: string }>>;
  readonly capUsd?: number;
};

export const makeRuntimeWorld = async ({
  capUsd,
  agentIds,
  planIds,
}: RuntimeWorldParams = {}): Promise<RuntimeWorld> => {
  const state = await makeDeliveryWorld({
    ...(capUsd === undefined ? {} : { capUsd }),
    ...(agentIds === undefined ? {} : { agentIds }),
    ...(planIds === undefined ? {} : { planIds }),
  });
  const errors: Array<unknown> = [];
  const runtime = createAutoRuntime({
    ctx: state.ctx,
    isEnabled: true,
    onError: (error) => {
      errors.push(error);
    },
    sleep: async () => undefined,
    watchPolls: 3,
  });
  return { state, runtime, errors, treeId: WORLD_TREE };
};

let restartCount = 0;

type RestartParams = {
  readonly world: RuntimeWorld;
  readonly isLeaseLapsed?: boolean;
};

export const restartedWorld = ({ world, isLeaseLapsed = true }: RestartParams): RuntimeWorld => {
  restartCount += 1;
  if (isLeaseLapsed) {
    world.state.world.clock.advance({ ms: 31_000 });
  }
  const ports = makeFakePorts({
    idPrefix: `restart${restartCount}`,
    deliveries: world.state.ports.deliveries,
    liveRuns: world.state.ports.liveRuns,
    runOutcomes: world.state.ports.runOutcomes,
  });
  const ctx = {
    db: world.state.world.db,
    scheduler: secondScheduler({
      world: world.state.world,
      ownerId: `window-restart-${restartCount}`,
    }),
    ports,
    now: world.state.world.clock.now,
  };
  const errors: Array<unknown> = [];
  const runtime = createAutoRuntime({
    ctx,
    isEnabled: true,
    onError: (error) => {
      errors.push(error);
    },
    sleep: async () => undefined,
    watchPolls: 3,
  });
  return { state: { ...world.state, ports, ctx }, runtime, errors, treeId: world.treeId };
};

type SayParams = {
  readonly world: RuntimeWorld;
  readonly id: string;
  readonly text: string;
};

export const userSays = async ({ world, id, text }: SayParams): Promise<void> => {
  await addUserRow({ world: world.state.world, id, text });
  await world.runtime.drive(world.treeId);
  await world.runtime.settled();
};

type DelegateParams = {
  readonly world: RuntimeWorld;
  readonly spec: unknown;
  readonly requestId?: string;
  readonly runId?: string;
};

export const autoDelegates = ({ world, spec, requestId = 'request-1', runId }: DelegateParams) => {
  const currentRun = runId ?? world.state.ports.autoTurns.at(-1)?.runId ?? '';
  const command: AgentCommand = {
    verb: 'delegate',
    args: { 'request-id': requestId, spec: JSON.stringify(spec) },
    grant: { ...WORLD_GRANT, runId: currentRun },
  };
  return world.runtime.executeCommand(command);
};

type CommandParams = {
  readonly world: RuntimeWorld;
  readonly verb: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly runId?: string;
};

export const autoCommand = ({ world, verb, args, runId }: CommandParams) => {
  const currentRun = runId ?? world.state.ports.autoTurns.at(-1)?.runId ?? '';
  const command: AgentCommand = {
    verb,
    args,
    grant: { ...WORLD_GRANT, runId: currentRun },
  };
  return world.runtime.executeCommand(command);
};

type AnswerParams = {
  readonly world: RuntimeWorld;
  readonly delegationId: string;
  readonly questionId: string;
  readonly text: string;
  readonly runId?: string;
};

export const autoAnswers = ({ world, delegationId, questionId, text, runId }: AnswerParams) =>
  autoCommand({
    world,
    verb: 'answer',
    args: { delegation: delegationId, question: questionId, text },
    ...(runId === undefined ? {} : { runId }),
  });

type EndAutoParams = {
  readonly world: RuntimeWorld;
  readonly text?: string;
};

export const autoTurnEnds = async ({
  world,
  text = 'Done for now.',
}: EndAutoParams): Promise<void> => {
  const turn = world.state.ports.autoTurns.at(-1);
  if (turn === undefined) {
    throw new Error('no Auto turn is running');
  }
  turn.onEnded(
    endedTurn({
      runId: turn.runId,
      deliveryId: turn.deliveryId,
      generation: turn.generation,
      assistantText: text,
    }),
  );
  await world.runtime.settled();
};

type ChildEndParams = {
  readonly world: RuntimeWorld;
  readonly index: number;
  readonly text: string;
  readonly overrides?: Partial<ChildTurnEnded>;
};

export const childTurnEnds = async ({
  world,
  index,
  text,
  overrides = {},
}: ChildEndParams): Promise<void> => {
  const turn = world.state.ports.childTurns[index];
  if (turn === undefined) {
    throw new Error(`no child turn ${index}`);
  }
  turn.onEnded({
    treeId: turn.treeId,
    generation: turn.generation,
    delegationId: turn.delegationId,
    attemptId: turn.attemptId,
    runId: turn.runId,
    childAgentId: turn.childAgentId,
    sessionId: turn.sessionId,
    assistantText: text,
    exit: 'ok',
    costUsd: 0.2,
    filesTouched: [],
    durationMs: 1_000,
    ...overrides,
  });
  await world.runtime.settled();
};
