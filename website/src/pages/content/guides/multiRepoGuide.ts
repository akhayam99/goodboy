import { GUIDE_NAV } from '../../../lib/GUIDE_NAV';
import { SITE } from '../../../lib/site';
import type { Guide } from '../Guide';

export const MULTI_REPO_GUIDE = {
  path: SITE.guides.multiRepo,
  title: 'Make changes across several repos in one agent session',
  navLabel: GUIDE_NAV.multiRepo,
  description:
    'Change several repositories with one goal in one coding agent session: each repo gets its own branch, worktree and pull request, and the merges go in order.',
  summary: 'One goal across several repos, with a branch and a pull request for each.',
  definition:
    'A multi-repo change is one goal that touches more than one repository. In Goodboy one session works across the repositories of a workspace: each repository the agents edit gets its own branch, worktree and pull request, and you review and merge each one.',
  sections: [
    {
      id: 'one-workspace',
      heading: 'Put the repos in one workspace',
      paragraphs: [
        'A workspace keeps your folders together, and one session can work across several of them. The Projects card of a session lists each repository it touches, with its branch and the size of its changes.',
        'A folder gets a branch only when an agent needs to edit it, so reading a repository costs no branch. The plus on the card adds another folder of the workspace, or connects a new one.',
      ],
      links: [
        {
          label: 'Workspace with several folders',
          href: `${SITE.doc('workspace')}#workspace-with-several-folders`,
        },
      ],
    },
    {
      id: 'which-folders',
      heading: 'Let the goal pick the folders, or pin them',
      paragraphs: [
        'On the New session page, Projects reads Auto picks. The folders the goal needs are mounted on start: the only repository of the workspace, the repository of a linked issue, and the repositories the goal names by their exact name. Later an agent mounts the folder it must edit by itself.',
        'Both share one allowance: the active folder, a folder linked by the issue and up to two more for each session. More wait for your approval.',
        'To choose yourself, open Projects and pin the folders. A pin always wins, and with a folder pinned nothing else is mounted on start.',
      ],
      links: [{ label: 'The New session page', href: `${SITE.doc('start')}#the-new-session-page` }],
    },
    {
      id: 'branch-per-repo',
      heading: 'One branch and one pull request for each repo',
      paragraphs: [
        'Every repository the agents edit gets its own worktree on its own branch, and a repository can have several branches in the same session. Each branch has its own pull request and its own Branch page.',
        'Actions stay with the repository. Merge, mark ready, reopen and close act on the repository of the branch on screen, never on another repository of the session. When a session has more than one repository, the push confirm names the one it pushes to.',
      ],
      links: [
        {
          label: 'Several branches per repo',
          href: `${SITE.doc('workspace')}#several-branches-per-repo`,
        },
        {
          label: 'Pull request on the Branch page',
          href: `${SITE.doc('review')}#pull-request-on-the-branch-page`,
        },
      ],
    },
    {
      id: 'merge-order',
      heading: 'Merge in the right order',
      paragraphs: [
        'Merge in order merges approved pull requests with green checks one at a time, across sessions and repositories, the smallest change first and a branch before the one that builds on it. Before each merge Goodboy reads the pull request again.',
        'It stops at the first pull request it cannot merge and says why. A conflict goes to the Lead, which resolves the rebase. You start it and you can stop it.',
      ],
      links: [{ label: 'Merge train', href: `${SITE.doc('board')}#merge-train` }],
    },
    {
      id: 'shared-context',
      heading: 'One context for every repo',
      paragraphs: [
        'The goal, the decisions and the running summary belong to the session, so the agent in one repository reads what was decided for the other.',
      ],
      links: [{ label: 'Context handoff between coding agents', href: SITE.guides.handoff }],
    },
  ],
  faq: {
    heading: 'Common questions',
    items: [
      {
        question: 'Do I need a monorepo?',
        answer:
          'No. A workspace can hold separate repositories, and one session works across the ones its goal needs.',
      },
      {
        question: 'How many repositories can one session use?',
        answer:
          'The active folder, a folder linked by the issue and up to two more start without asking. More wait for your approval.',
      },
      {
        question: 'Does Goodboy push to every repository at once?',
        answer:
          'No. You push each branch yourself, and the confirm names the repository when the session has more than one. Agents never push, and you merge.',
      },
      {
        question: 'Can agents edit two repos at the same time?',
        answer:
          'Yes. Each repository has its own worktree, so the agents work in parallel without touching each other.',
      },
    ],
  },
  cta: {
    heading: 'Ship a change across two repos',
    lead: 'Install Goodboy, add both repositories to a workspace and start one session for the whole change.',
  },
  related: [SITE.guides.worktrees, SITE.guides.parallel, SITE.guides.glossary],
} as const satisfies Guide;
