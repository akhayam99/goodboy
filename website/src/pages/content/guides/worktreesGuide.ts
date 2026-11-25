import { GUIDE_NAV } from '../../../lib/GUIDE_NAV';
import { SITE } from '../../../lib/site';
import type { Guide } from '../Guide';

export const WORKTREES_GUIDE = {
  path: SITE.guides.worktrees,
  title: 'How to use git worktrees with AI coding agents',
  navLabel: GUIDE_NAV.worktrees,
  description:
    'Why each coding agent needs its own git worktree, how to set one up by hand with git worktree add, and how Goodboy gives every branch its own worktree.',
  summary: 'Why each agent needs its own folder, the git commands, and how Goodboy automates them.',
  definition:
    'A git worktree is a second working folder for the same repository, checked out on its own branch. Give each coding agent its own worktree and the agents edit in parallel without overwriting each other or your checkout, and every branch ends as its own pull request.',
  sections: [
    {
      id: 'why-isolation',
      heading: 'Why agents need their own folder',
      paragraphs: [
        'Two agents in one checkout write to the same files. You cannot tell whose change is whose, and a test run by one agent reads files the other is still editing.',
        'Your own work has the same problem. Uncommitted changes in your checkout mix with whatever an agent edits there, so you cannot review the agent alone.',
        'A worktree fixes this without a second clone. It has its own files, its own branch and its own changes, and it shares the repository history with the main checkout.',
      ],
    },
    {
      id: 'by-hand',
      heading: 'Set one up by hand',
      paragraphs: [
        'These are the git commands behind the idea, with a repository called payments-api.',
      ],
      steps: [
        {
          text: 'Create a worktree on a new branch, next to your checkout.',
          command: 'git worktree add -b fix/webhook-retry ../payments-api-retry origin/main',
        },
        {
          text: 'Prepare it like a fresh clone. Git-ignored files such as .env.local and installed dependencies are not in a fresh worktree, so copy what the agent needs and run your install.',
        },
        {
          text: 'Start the agent inside that folder.',
          command: 'cd ../payments-api-retry',
        },
        {
          text: 'List your worktrees whenever you lose track.',
          command: 'git worktree list',
        },
        {
          text: 'After the branch is merged, go back to your checkout, then remove the folder and the branch.',
          command:
            'cd ../payments-api\ngit worktree remove ../payments-api-retry\ngit branch -d fix/webhook-retry',
        },
      ],
    },
    {
      id: 'in-goodboy',
      heading: 'How Goodboy does it',
      paragraphs: [
        'Goodboy runs those steps for you, one worktree for each branch an agent works on.',
      ],
      items: [
        {
          id: 'one-per-branch',
          title: 'One worktree for each branch',
          paragraphs: [
            'Each branch gets its own worktree, a separate folder with its own changes and its own pull request, so agents edit in parallel without touching your checkout. The folder is named gb- and six characters, such as gb-7k2q9x, and the app shows the session and the branch next to it.',
            'A session works on several branches of one repository at once, each in its own worktree.',
          ],
          links: [
            { label: 'Worktrees', href: `${SITE.doc('workspace')}#worktrees` },
            {
              label: 'Several branches per repo',
              href: `${SITE.doc('workspace')}#several-branches-per-repo`,
            },
          ],
        },
        {
          id: 'start-usable',
          title: 'New worktrees start usable',
          paragraphs: [
            'A fresh worktree is a clean checkout, so Goodboy carries what it lacks. You tick the git-ignored files to copy into every worktree it creates, and a secret stays unticked until you choose it. The setup command is prefilled from the lockfile, such as pnpm install, and it never runs until you click Run.',
          ],
          links: [
            {
              label: 'New worktrees start usable',
              href: `${SITE.doc('workspace')}#new-worktrees-start-usable`,
            },
          ],
        },
        {
          id: 'git-first',
          title: 'A session branches from the latest commit',
          paragraphs: [
            'A repository with no commit yet holds sessions back, because a session branches from the latest commit. The board offers Make the first commit, which shows what goes in before it happens.',
          ],
          links: [
            {
              label: 'Track a folder with git later',
              href: `${SITE.doc('workspace')}#track-a-folder-with-git-later`,
            },
          ],
        },
        {
          id: 'clean-up',
          title: 'Clean up the folders you no longer need',
          paragraphs: [
            'Storage lists the worktree folders of archived, deleted or gone sessions with their size, and marks the ones that are safe to remove. Goodboy proposes and never removes by itself: nothing goes until you click, and Undo puts the folders back.',
          ],
          links: [
            {
              label: 'Worktrees of a project',
              href: `${SITE.doc('storage')}#worktrees-of-a-project`,
            },
            { label: 'Worktree folders', href: `${SITE.doc('storage')}#worktree-folders` },
          ],
        },
      ],
    },
  ],
  faq: {
    heading: 'Common questions',
    items: [
      {
        question: 'Can two worktrees use the same branch?',
        answer:
          'Not by default. Git refuses to check out one branch in two worktrees at once, which is why every agent works on its own branch.',
      },
      {
        question: 'Does a worktree copy the whole repository?',
        answer:
          'No. It adds a working folder and shares the history of the repository with the main checkout, so it costs the size of the files and not the size of a clone.',
      },
      {
        question: 'Do agents change my open checkout?',
        answer:
          'No. In a git repository the agents edit in their own worktrees, so your checkout and its uncommitted changes stay as you left them.',
      },
      {
        question: 'Does Goodboy delete worktrees on its own?',
        answer:
          'No. Storage shows which folders are safe to remove and removes them only when you click.',
      },
    ],
  },
  cta: {
    heading: 'Let Goodboy run the worktrees',
    lead: 'Install it, add a repository and start a session. Each branch the agents work on gets its own worktree.',
  },
  related: [SITE.guides.parallel, SITE.guides.multiRepo, SITE.guides.review],
} as const satisfies Guide;
