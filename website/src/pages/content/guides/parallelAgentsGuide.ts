import { GUIDE_NAV } from '../../../lib/GUIDE_NAV';
import { SITE } from '../../../lib/site';
import type { Guide } from '../Guide';

export const PARALLEL_AGENTS_GUIDE = {
  path: SITE.guides.parallel,
  title: 'How to run multiple coding agents in parallel',
  navLabel: GUIDE_NAV.parallel,
  description:
    'Run several coding agents at once without collisions: one session for each goal, one worktree for each branch, and one board that shows which cards wait on you.',
  summary: 'One session for each goal, a stage board for all of them and cards that wait on you.',
  definition:
    'To run coding agents in parallel, give each goal its own session with its own branch and folder, and watch every session on one board. Goodboy starts a session for each goal, keeps their files apart and puts a card in front of you when an agent needs an answer.',
  sections: [
    {
      id: 'three-needs',
      heading: 'What parallel agents need',
      paragraphs: [
        'Several terminals are the usual start, and they break down in three places. The agents share one checkout, you lose track of which one is stuck, and nothing tells you when one is waiting.',
        'Parallel work needs a separate folder for each agent, one place that shows where each task stands, and a way to be called when an agent cannot go on.',
      ],
      links: [{ label: 'Git worktrees for coding agents', href: SITE.guides.worktrees }],
    },
    {
      id: 'session-per-goal',
      heading: 'Start one session for each goal',
      paragraphs: [
        'A session is one goal with its own limit and its own shared notes. Write the goal or pick an open issue from Tasks, press Start, and a Lead plans the run and starts the agents it needs.',
        'Sessions stay apart because each branch an agent works on gets its own worktree. Two sessions can work on the same repository at the same time.',
        'Sessions in the top bar lists them all, with Pinned first and then Needs you, Running, In review and Building. Type to filter, and press Enter to open one.',
      ],
      links: [
        { label: 'The New session page', href: `${SITE.doc('start')}#the-new-session-page` },
        { label: 'Sessions', href: `${SITE.doc('switching')}#sessions` },
      ],
    },
    {
      id: 'stage-board',
      heading: 'See every session on the stage board',
      paragraphs: [
        'The board puts every session of a workspace in a lane by stage: Building, Running, In review, Done and Archived. A session moves to the lane that matches what is happening in it, and you never drag a card.',
        'A card shows its title, its project and one signal, such as a failed check, an open question or its pull request. While an agent works, a line says what it does, in words like Running pnpm test in payments-api.',
      ],
      links: [
        { label: 'Stage board', href: `${SITE.doc('board')}#stage-board` },
        { label: 'Session card', href: `${SITE.doc('board')}#session-card` },
      ],
    },
    {
      id: 'cards-that-wait',
      heading: 'Cards that wait on you',
      paragraphs: [
        'A session that waits on you shows once, as a card in the Needs you row above the lanes, with the oldest wait first. The card gives the reason, such as the question itself, and how long it has waited.',
        'A click opens the session at the exact point that needs you: a question on its answer, a plan on its review, a stopped or paused run on its run. A key jumps to the next session that needs you, and while no Goodboy window is in front, the app icon counts the sessions that wait.',
        'A blocking question holds its step until you answer. You can answer it, send it as a message, or hand it to another agent with Let an agent decide.',
      ],
      links: [
        { label: 'Needs you', href: `${SITE.doc('board')}#needs-you` },
        { label: 'Open questions', href: `${SITE.doc('workflows')}#open-questions` },
        { label: 'Notifications', href: `${SITE.doc('switching')}#notifications` },
      ],
    },
    {
      id: 'merge-in-order',
      heading: 'Merge what finished, in order',
      paragraphs: [
        'When pull requests in the In review lane are approved with green checks, Merge in order merges them one at a time, the smallest change first and a branch before the one that builds on it. It works across sessions and repositories.',
        'The train stops at the first pull request it cannot merge and says why. Nothing merges without your gesture.',
      ],
      links: [{ label: 'Merge train', href: `${SITE.doc('board')}#merge-train` }],
    },
    {
      id: 'keep-it-bounded',
      heading: 'Keep many agents bounded',
      paragraphs: [
        'Every session has its own limit, so ten sessions do not mean one unbounded bill. Set the limit before you start and read the spend while the agents run.',
      ],
      links: [{ label: 'Control coding agent costs', href: SITE.guides.costs }],
    },
  ],
  faq: {
    heading: 'Common questions',
    items: [
      {
        question: 'What happens when two sessions change the same repository?',
        answer:
          'Each works on its own branch in its own worktree, so their files never overlap while they run. Merge in order stops at the first pull request it cannot merge and says why.',
      },
      {
        question: 'Do parallel agents share what they learn?',
        answer:
          'Agents in one session share its goal, decisions and running summary. Another session starts with its own.',
      },
      {
        question: 'How do I know which agent needs me?',
        answer:
          'The Needs you row on the board lists every session that waits, with the reason and the wait time. A click opens the session where the answer goes.',
      },
      {
        question: 'Can I mix different coding agents?',
        answer:
          'Yes. Each run, role and workflow step can use its own provider and model, among Claude Code, Codex, Cursor, Gemini and Copilot.',
      },
    ],
  },
  cta: {
    heading: 'Run your next two tasks side by side',
    lead: 'Install Goodboy, sign in to an agent you already use and start a session for each task.',
  },
  related: [SITE.guides.worktrees, SITE.guides.handoff, SITE.guides.together],
} as const satisfies Guide;
