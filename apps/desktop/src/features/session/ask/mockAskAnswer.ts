const AGENT_LINE = /^- \[(A\d+)\] ([^·\n]+?) · ([a-z ]+)/gm;

type MockAgent = {
  readonly key: string;
  readonly name: string;
  readonly word: string;
};

type PackParams = {
  readonly pack: string;
};

const agentsIn = ({ pack }: PackParams): ReadonlyArray<MockAgent> =>
  [...pack.matchAll(AGENT_LINE)].map((match) => ({
    key: match[1] ?? '',
    name: (match[2] ?? '').trim(),
    word: (match[3] ?? '').trim(),
  }));

type HandleParams = PackParams & {
  readonly key: string;
  readonly fallback: string;
};

const handle = ({ pack, key, fallback }: HandleParams): string =>
  pack.includes(`[${key}]`) ? `[[${key}]]` : fallback;

type AgentChipParams = {
  readonly agent: MockAgent | undefined;
  readonly fallback: string;
};

const agentChip = ({ agent, fallback }: AgentChipParams): string =>
  agent === undefined ? fallback : `[[${agent.key}]]`;

type AnswerParams = {
  readonly question: string;
  readonly pack: string;
};

export const mockAskAnswer = ({ question, pack }: AnswerParams): string => {
  const agents = agentsIn({ pack });
  const running = agents.find((agent) => agent.word.startsWith('running'));
  const waiting = agents.find((agent) => agent.word.startsWith('needs you'));
  const failed = agents.find((agent) => agent.word.startsWith('failed'));
  const worker = agentChip({ agent: running ?? agents[0], fallback: 'the running agent' });
  const asker = agentChip({ agent: waiting ?? agents[1], fallback: 'the planner' });
  const tester = agentChip({ agent: failed, fallback: 'the tester' });
  const question1 = handle({ pack, key: 'Q1', fallback: 'the open question' });
  const pr = handle({ pack, key: 'PR', fallback: 'the pull request' });
  const run = handle({ pack, key: 'R1', fallback: 'the run' });
  const plan = handle({ pack, key: 'D1', fallback: 'the plan' });
  const text = question.toLowerCase();
  if (/ready|review/.test(text)) {
    return `**5 comments are ready to review, on webhook.ts and queue.ts.** Mara Quint and Theo Varga asked for 2 each, Ines Okafor for 1. None is blocked. They are on ${pr}, and ${run} has already handled them.`;
  }
  if (/cost|spend|much|\$/.test(text)) {
    return `**$3.42 so far in this session, $0.08 of it from Ask.** ${worker} accounts for $2.10 and ${asker} for $0.74.`;
  }
  if (/fail/.test(text)) {
    return `**${failed?.name ?? 'The tester'} failed because the retry test still expects 3 attempts and the code now sends 5.** The assertion is at [[webhook.test.ts:41]]. ${worker} raised the limit in its last commit and has not updated the test yet.\n<<suggest target="${running?.key ?? 'A1'}">>Update webhook.test.ts to expect 5 attempts.<</suggest>>`;
  }
  if (/change|since|new/.test(text)) {
    return `**Since 09:40, two commits landed and 4 comments moved to ready.** ${asker} revised ${plan} and raised ${question1}. ${tester} ran once.`;
  }
  if (/need|block|question/.test(text)) {
    return `**One question is blocking, and one comment could not be fixed.** It asks whether retries stop after 5 attempts or keep backing off, see ${question1} and ${plan}.\n- ${worker} is still working on 2 of the 9 comments on ${pr}.\n- ${run} could not fix the comment on [[webhook.ts:88]] because Retry-After can arrive as a date.\n<<suggest target="Q1">>Stop after 5 attempts, then move the message to the dead-letter queue.<</suggest>>`;
  }
  return `**Here is what the session shows right now.** ${worker} is running, ${asker} waits on ${question1} and 2 of the 9 comments on ${pr} are in progress.`;
};
