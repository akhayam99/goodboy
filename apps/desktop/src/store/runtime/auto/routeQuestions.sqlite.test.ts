import { describe, expect, it, vi } from 'vitest';
import { batchInput, childInput, makeAutoWorld } from './testing/autoWorld';
import { routeQuestions } from './routeQuestions';

const ASK = 'Need a choice.\n<<ctx-question blocking="true">>Which format?<</ctx-question>>';

const inTree = async () => {
  const world = await makeAutoWorld({ agentIds: ['agent-scout', 'agent-loose'] });
  await world.scheduler.admit(
    batchInput({ children: [childInput({ key: 'scout', agentId: 'agent-scout' })] }),
  );
  return world;
};

describe('where the questions of a turn go', () => {
  it('sends the question of a child of an Auto tree to the tree, never to the open questions', async () => {
    const world = await inTree();

    expect(await routeQuestions({ db: world.db, agentId: 'agent-scout', assistantText: ASK })).toBe(
      'tree',
    );
  });

  it('keeps the question of any other agent on the open questions flow it has today', async () => {
    const world = await inTree();

    expect(await routeQuestions({ db: world.db, agentId: 'agent-loose', assistantText: ASK })).toBe(
      'open_questions',
    );
  });

  it('asks the database nothing when the reply holds no question', async () => {
    const world = await inTree();
    const select = vi.spyOn(world.db, 'select');

    const route = await routeQuestions({
      db: world.db,
      agentId: 'agent-scout',
      assistantText: 'Found three callers.',
    });

    expect(route).toBe('open_questions');
    expect(select).not.toHaveBeenCalled();
  });
});
