import { GUIDE_NAV } from '../../../lib/GUIDE_NAV';
import { SITE } from '../../../lib/site';
import type { Guide } from '../Guide';

export const GLOSSARY_GUIDE = {
  path: SITE.guides.glossary,
  title: 'Agentic coding glossary: terms and definitions',
  navLabel: GUIDE_NAV.glossary,
  description:
    'Plain definitions of the terms of agentic coding: session, worktree, branch, Lead, workflow, decision, limit and more, each linked to its guide and its docs.',
  summary: 'Short definitions of session, worktree, Lead, workflow, decision and more.',
  definition:
    'Agentic coding is building software by directing coding agents that read, edit and test code, while you set the goal, decide and review. These are the terms Goodboy uses for it, each with a short definition and a link to the page that explains it.',
  sections: [
    {
      id: 'terms',
      heading: 'Terms',
      paragraphs: [
        'The terms are in alphabetical order. For the bigger picture, start with the guide to the agentic development environment.',
      ],
      links: [{ label: 'What is an agentic development environment?', href: SITE.ade }],
      items: [
        {
          id: 'agent',
          title: 'Agent',
          paragraphs: [
            'One chat inside a session, with its own provider and model. A coding agent is a tool such as Claude Code, Codex, Cursor, Gemini or Copilot that reads and edits code.',
          ],
          links: [
            { label: 'Agents', href: SITE.doc('agents') },
            { label: 'Use several coding agents together', href: SITE.guides.together },
          ],
        },
        {
          id: 'ade',
          title: 'Agentic development environment (ADE)',
          paragraphs: [
            'Where you run several coding agents at once and stay in charge of the work. Each agent works on its own branch in an isolated copy of the code, and you review the result before anything merges.',
          ],
          links: [{ label: 'What is an ADE?', href: SITE.ade }],
        },
        {
          id: 'artifact',
          title: 'Artifact',
          paragraphs: ['A plan, report or wireframe that an agent saves as its own page.'],
          links: [{ label: 'Artifacts', href: SITE.doc('artifacts') }],
        },
        {
          id: 'board',
          title: 'Board',
          paragraphs: [
            'The page that shows every session of a workspace in lanes by stage: Building, Running, In review, Done and Archived. Sessions that wait on you sit above the lanes.',
          ],
          links: [
            { label: 'Stage board', href: `${SITE.doc('board')}#stage-board` },
            { label: 'Run agents in parallel', href: SITE.guides.parallel },
          ],
        },
        {
          id: 'branch',
          title: 'Branch',
          paragraphs: [
            'The line of commits an agent works on. In Goodboy each branch of a session has its own worktree, its own pull request and its own Branch page.',
          ],
          links: [
            {
              label: 'Branch page',
              href: `${SITE.doc('review')}#pull-request-on-the-branch-page`,
            },
            { label: 'Git worktrees for coding agents', href: SITE.guides.worktrees },
          ],
        },
        {
          id: 'context',
          title: 'Context',
          paragraphs: [
            'What the next agent reads before it starts: the goal, the decisions and the running summary. They travel with the session, so a new agent starts informed instead of from a blank chat.',
          ],
          links: [
            { label: 'Shared context', href: SITE.doc('context') },
            { label: 'Context handoff between agents', href: SITE.guides.handoff },
          ],
        },
        {
          id: 'decision',
          title: 'Decision',
          paragraphs: [
            'A choice you settled, recorded once with a number so the agents after it read it. Replacing or withdrawing one needs a reason.',
          ],
          links: [{ label: 'Decisions', href: `${SITE.doc('context')}#decisions` }],
        },
        {
          id: 'lead',
          title: 'Lead',
          paragraphs: [
            'The agent that plans a run, hands the work to helpers and asks you only for what your permission rows say. The Lead never writes code.',
          ],
          links: [{ label: 'Lead', href: `${SITE.doc('agents')}#lead` }],
        },
        {
          id: 'limit',
          title: 'Limit',
          paragraphs: [
            'A cap on what a run or a session can spend. It either pauses the work or only warns you, as you choose.',
          ],
          links: [
            { label: 'Limit', href: `${SITE.doc('workflows')}#limit` },
            { label: 'Control coding agent costs', href: SITE.guides.costs },
          ],
        },
        {
          id: 'merge-train',
          title: 'Merge train',
          paragraphs: [
            'Merge in order. It merges approved pull requests with green checks one at a time, across sessions and repositories, and only when you start it.',
          ],
          links: [
            { label: 'Merge train', href: `${SITE.doc('board')}#merge-train` },
            { label: 'Multi-repo changes with agents', href: SITE.guides.multiRepo },
          ],
        },
        {
          id: 'monthly-cap',
          title: 'Monthly cap',
          paragraphs: [
            'A spending cap on one provider for the month, with a warning at the share of it you choose. Past that share, the next turn goes to another provider with room.',
          ],
          links: [
            {
              label: 'Monthly cap and budget alert',
              href: `${SITE.doc('providers')}#monthly-cap-and-budget-alert`,
            },
          ],
        },
        {
          id: 'needs-you',
          title: 'Needs you',
          paragraphs: [
            'The row of cards at the top of the board, one for each session that waits on you. A click opens the session at the point that needs you.',
          ],
          links: [{ label: 'Needs you', href: `${SITE.doc('board')}#needs-you` }],
        },
        {
          id: 'open-question',
          title: 'Open question',
          paragraphs: [
            'A question an agent asks you. A blocking question holds its step until you answer, and you can hand it to another agent.',
          ],
          links: [{ label: 'Open questions', href: `${SITE.doc('workflows')}#open-questions` }],
        },
        {
          id: 'plan',
          title: 'Plan',
          paragraphs: [
            'The steps an agent writes before it builds, kept as an artifact that you approve or revise.',
          ],
          links: [{ label: 'Artifacts', href: SITE.doc('artifacts') }],
        },
        {
          id: 'project',
          title: 'Project',
          paragraphs: ['One repository or plain folder inside a workspace.'],
          links: [
            {
              label: 'Workspace with several folders',
              href: `${SITE.doc('workspace')}#workspace-with-several-folders`,
            },
          ],
        },
        {
          id: 'provider',
          title: 'Provider',
          paragraphs: [
            'Where the model of an agent runs, such as Claude, Codex, Cursor, Gemini or Copilot. You sign in to each from the app and keep your plan with it.',
          ],
          links: [
            { label: 'Providers', href: SITE.doc('providers') },
            { label: 'Use several coding agents together', href: SITE.guides.together },
          ],
        },
        {
          id: 'resolve',
          title: 'Resolve',
          paragraphs: [
            'Turning review comments into commits. You check the comments and press Fix, and an agent ends each one with a fix, a reply or a question.',
          ],
          links: [
            { label: 'Resolve', href: `${SITE.doc('review')}#resolve` },
            { label: 'Fix pull request review comments', href: SITE.guides.review },
          ],
        },
        {
          id: 'role',
          title: 'Role',
          paragraphs: [
            'The job of an agent. A role sets its instructions, its default model and what it hands back. Goodboy has Scout, Debug, Plan, Implement, Review, Test, Resolve, Docs and Generalist.',
          ],
          links: [{ label: 'Roles', href: `${SITE.doc('agents')}#roles` }],
        },
        {
          id: 'run',
          title: 'Run',
          paragraphs: [
            'One go at a goal inside a session, started as a workflow, a single agent or the Lead.',
          ],
          links: [{ label: 'Start a run', href: `${SITE.doc('start')}#start-a-run` }],
        },
        {
          id: 'scout',
          title: 'Scout',
          paragraphs: ['A role that reads the code and answers, and changes nothing.'],
          links: [{ label: 'Roles', href: `${SITE.doc('agents')}#roles` }],
        },
        {
          id: 'session',
          title: 'Session',
          paragraphs: [
            'One goal, the unit of work, with its own limit and shared notes. A session holds the agents, the runs and the artifacts for that goal.',
          ],
          links: [
            { label: 'Sessions', href: `${SITE.doc('switching')}#sessions` },
            { label: 'Run agents in parallel', href: SITE.guides.parallel },
          ],
        },
        {
          id: 'workflow',
          title: 'Workflow',
          paragraphs: [
            'A list of steps you can reuse, where each step gets its own agent. A run follows it as written or adapts it as it goes.',
          ],
          links: [{ label: 'Workflows', href: SITE.doc('workflows') }],
        },
        {
          id: 'workspace',
          title: 'Workspace',
          paragraphs: [
            'Where you work, named after what you work on. It holds your folders and your sessions.',
          ],
          links: [{ label: 'Workspaces and folders', href: SITE.doc('workspace') }],
        },
        {
          id: 'worktree',
          title: 'Worktree',
          paragraphs: [
            'A second working folder for the same repository, checked out on its own branch. It is what lets agents edit in parallel without touching each other or your checkout.',
          ],
          links: [
            { label: 'Worktrees', href: `${SITE.doc('workspace')}#worktrees` },
            { label: 'Git worktrees for coding agents', href: SITE.guides.worktrees },
          ],
        },
      ],
    },
  ],
  cta: {
    heading: 'See the terms at work',
    lead: 'Install Goodboy and start a session. The board, the Lead and the worktrees are all there from the first goal.',
  },
  related: [
    SITE.guides.parallel,
    SITE.guides.worktrees,
    SITE.guides.handoff,
    SITE.guides.costs,
    SITE.guides.review,
  ],
} as const satisfies Guide;
