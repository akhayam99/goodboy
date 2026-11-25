import { GUIDE_NAV } from '../../../lib/GUIDE_NAV';
import { SITE } from '../../../lib/site';
import type { Guide } from '../Guide';

export const AGENTS_TOGETHER_GUIDE = {
  path: SITE.guides.together,
  title: 'Use Claude Code, Codex, Cursor, Gemini and Copilot together',
  navLabel: GUIDE_NAV.together,
  description:
    'Use Claude Code, Codex, Cursor, Gemini and Copilot in one workspace: sign in from the app, keep your plans, and choose which agent and model handles each step.',
  summary: 'Sign in to each agent from the app, keep your plans and choose who does each step.',
  definition:
    'You can use Claude Code, Codex, Cursor, Gemini and Copilot in one workspace. Goodboy runs the agents already installed on your computer, you sign in to each one from the app and keep the plans you already pay for, and you choose which agent and model handles each role or step.',
  sections: [
    {
      id: 'sign-in',
      heading: 'Connect the agents you have',
      paragraphs: [
        "Setup opens on your agents. Each of the five has a row that says where its command line tool stands: Ready with its version and account, Not signed in with Sign in, Not installed with the exact command to install it, Can't start with the output of the tool and Check again, or Update needed.",
        'One ready agent is enough to start. Rows check again when you come back to the window, and a provider billed by API key sits behind Use an API key instead. Keys stay in your system password store.',
        'Each provider has its own page in Connections, with its usage first, then its models, your account and what works with it.',
      ],
      links: [
        { label: 'Your agents', href: `${SITE.doc('setup')}#your-agents` },
        { label: 'One page per provider', href: `${SITE.doc('setup')}#one-page-per-provider` },
        { label: 'Providers', href: SITE.doc('providers') },
      ],
    },
    {
      id: 'keep-your-plans',
      heading: 'Keep the plans you already pay for',
      paragraphs: [
        'Goodboy runs the agents you already pay for. A chip in the top bar shows how much of your Claude and Codex plans is left, and Copilot turns show their count of premium requests in place of a cost.',
      ],
      links: [{ label: 'Usage limits chip', href: `${SITE.doc('providers')}#usage-limits-chip` }],
    },
    {
      id: 'who-does-what',
      heading: 'Choose who does what',
      paragraphs: [
        'Nine roles come with the app: Scout, Debug, Plan, Implement, Review, Test, Resolve, Docs and Generalist. A role sets the instructions of the agent, its default model and what it hands back.',
        'A workflow step follows its role by default, and Pin a model gives it its own provider, model and effort. A light model can read the code as a Scout while a strong one plans, and Goodboy records what actually ran.',
        'The model picker leads with Auto and what it resolves to now, then the provider, the model family, the version and the effort.',
      ],
      links: [
        { label: 'Roles', href: `${SITE.doc('agents')}#roles` },
        { label: 'Model per step', href: `${SITE.doc('workflows')}#model-per-step` },
        { label: 'Model picker', href: `${SITE.doc('providers')}#model-picker` },
      ],
    },
    {
      id: 'order-and-fallback',
      heading: 'Set an order and a fallback',
      paragraphs: [
        'Provider order, in Settings under Models, lists the providers of a workspace, and you set each one to On, Backup only or Off. Provider priority decides when several fit: By order, where your order wins, or By load, where the provider that has used the least of its limit wins.',
        'When a provider hits its limit and another eligible one is connected, the turn can move there, and the chat records where it went. When no provider can take it, the stopped turn offers to continue at the reset time.',
        'Know what each role can run on. Reading roles such as Scout, Planner and Reviewer can run on Cursor too, and the agents the Lead starts to write code run on Claude or Codex. When no provider can take a role, the Lead hears each provider and why.',
      ],
      links: [
        {
          label: 'Provider order and Auto',
          href: `${SITE.doc('providers')}#provider-order-and-auto`,
        },
        {
          label: 'Fallback when a limit is hit',
          href: `${SITE.doc('providers')}#fallback-when-a-limit-is-hit`,
        },
        { label: 'Lead', href: `${SITE.doc('agents')}#lead` },
      ],
    },
    {
      id: 'what-carries-over',
      heading: 'What carries from one agent to the next',
      paragraphs: [
        'The goal, the decisions and the running summary belong to the session, not to an agent, so a different agent reads them. When a step runs on a model that does not keep the conversation, such as Cursor, Codex or Gemini, its history arrives as a short brief of at most 8,000 estimated tokens.',
      ],
      links: [{ label: 'Context handoff between coding agents', href: SITE.guides.handoff }],
    },
  ],
  faq: {
    heading: 'Common questions',
    items: [
      {
        question: 'Do I need an account with Goodboy?',
        answer:
          'No. Goodboy is free to download and needs no account. You sign in to each coding agent, and your plans stay with the provider.',
      },
      {
        question: 'Do I need all five agents?',
        answer: 'No. One ready agent is enough, and you can add the others when you want them.',
      },
      {
        question: 'Where are my API keys kept?',
        answer: 'In your system password store.',
      },
      {
        question: 'Can I pin one model for a step?',
        answer:
          'Yes. Pin a model gives a workflow step its own provider, model and effort, and a model you pin beats the automatic choice.',
      },
    ],
  },
  cta: {
    heading: 'Bring the agents you already use',
    lead: 'Install Goodboy, check which agents are ready on your computer and start a session with the one you prefer.',
  },
  related: [SITE.guides.costs, SITE.guides.handoff, SITE.guides.parallel],
} as const satisfies Guide;
