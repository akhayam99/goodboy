import { GUIDE_NAV } from '../../../lib/GUIDE_NAV';
import { SITE } from '../../../lib/site';
import type { Guide } from '../Guide';

export const REVIEW_COMMENTS_GUIDE = {
  path: SITE.guides.review,
  title: 'Fix pull request review comments with AI',
  navLabel: GUIDE_NAV.review,
  description:
    'Turn pull request review comments into commits with a coding agent. Check the comments, press Fix, read each result and push once. Nothing leaves your machine first.',
  summary: 'Check the comments, press Fix, read each result and push once.',
  definition:
    'Fixing review comments with an agent means you check the comments, an agent turns each one into a commit, a reply or a question, you accept, edit or skip each result, and you push once. In Goodboy this happens on the Branch page, and nothing leaves your machine until you push.',
  sections: [
    {
      id: 'the-loop',
      heading: 'The loop on the Branch page',
      paragraphs: [
        'The Branch page holds one branch: its pull request, review comments, changed files, commits and checks. Open a branch from the Projects card of a session, then open its Comments tab.',
      ],
      steps: [
        {
          text: 'Check the comments you want fixed, or use Fix comments to check every open one.',
        },
        {
          text: 'Press Fix. One agent works through them in its own copy of the branch and ends each comment with a fix, a reply or a question.',
        },
        {
          text: 'Read each result and accept, edit or skip it. Answer the questions the agent asked.',
        },
        {
          text: 'Press Push N commits in the Branch header. A preview counts the fixes, the replies and the threads to resolve, and one Push sends them to the host.',
        },
      ],
      links: [
        { label: 'Resolve', href: `${SITE.doc('review')}#resolve` },
        { label: 'Push fixes and replies', href: `${SITE.doc('review')}#push-fixes-and-replies` },
      ],
    },
    {
      id: 'what-you-see',
      heading: 'What each comment tells you',
      paragraphs: [
        'The list groups comments under Needs you, Working, Done and Left open, and each comment names its state, such as Question, Fix ready or Failed.',
        'Open a comment to read it in a drawer beside the list, with the code around the line. Fix, Reply and Skip have a key each (F, R and S), and J and K move to the next and the previous comment.',
        'If the reviewer edits a comment after the agent drafted an answer, you choose to redraft it or keep the draft.',
      ],
      links: [
        { label: 'Comment states', href: `${SITE.doc('review')}#comment-states` },
        { label: 'Review sources', href: `${SITE.doc('review')}#review-sources` },
      ],
    },
    {
      id: 'many-at-once',
      heading: 'Handle many comments at once',
      paragraphs: [
        'Fix comments checks every open comment, Use the recommended answers answers the open questions of the agent in one go, and Apply fix takes every waiting fix, with Undo right after.',
        'A comment that asks for a rework starts a run instead of a quick fix. The goal is written from the comment, and you can add up to three more open comments from the branch.',
      ],
      links: [
        { label: 'Bulk actions', href: `${SITE.doc('review')}#bulk-actions` },
        { label: 'Run from a comment', href: `${SITE.doc('review')}#run-from-a-comment` },
      ],
    },
    {
      id: 'your-voice',
      heading: 'Replies in your voice',
      paragraphs: [
        'Choose the tone of the replies the agent drafts: Terse, Friendly, Formal or Like your replies, which learns from your last 20 review replies on GitHub.',
      ],
      links: [
        { label: 'Replies in your voice', href: `${SITE.doc('review')}#replies-in-your-voice` },
      ],
    },
    {
      id: 'tidy-and-notes',
      heading: 'Tidy the commits and review your own diff',
      paragraphs: [
        'Before reviewers see the fix commits, fold a fix into the commit it belongs to, squash, reword or drop it. Goodboy keeps a backup, and Undo rewrite restores the branch.',
        'The same loop works before a pull request exists. Leave notes on lines or whole files in the Changes section and hand the open ones to an agent. A note fix starts from your working tree as it is, and Apply refuses to overwrite a file of yours.',
      ],
      links: [
        {
          label: 'Squash and fold the resolve commits',
          href: `${SITE.doc('review')}#squash-and-fold-the-resolve-commits`,
        },
        {
          label: 'Notes before a pull request',
          href: `${SITE.doc('review')}#notes-before-a-pull-request`,
        },
      ],
    },
    {
      id: 'on-your-machine',
      heading: 'What stays on your machine',
      paragraphs: [
        'The agent works in its own copy of your branch, and its fixes are commits on your computer. They reach GitHub, GitLab or Bitbucket when you push, and you merge. The prompts go to the provider you chose.',
        'If a check of the repository stops the push, the failure card names the check, and an agent can fix what the check reports without skipping it.',
      ],
    },
  ],
  faq: {
    heading: 'Common questions',
    items: [
      {
        question: 'Does it push without asking?',
        answer:
          'No. Fixes stay on your machine until you press Push, and the push preview lists what goes out first.',
      },
      {
        question: 'Does it work on GitLab and Bitbucket?',
        answer:
          'Yes. The Branch page works the same on GitHub, GitLab and Bitbucket. Bitbucket cannot resolve a thread, so a Bitbucket thread stays open.',
      },
      {
        question: 'Can the agent answer a comment without changing code?',
        answer:
          'Yes. Each comment ends in a fix, a reply or a question, and you decide on each result.',
      },
      {
        question: 'What if the branch moved while the agent worked?',
        answer:
          'You can still accept the fix. It lands on top of the latest commit, and on a conflict the branch goes back to its old head.',
      },
    ],
  },
  cta: {
    heading: 'Clear your next review in one pass',
    lead: 'Install Goodboy, open a branch with review comments and press Fix.',
  },
  related: [SITE.guides.worktrees, SITE.guides.costs, SITE.guides.glossary],
} as const satisfies Guide;
