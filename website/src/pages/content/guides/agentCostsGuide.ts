import { GUIDE_NAV } from '../../../lib/GUIDE_NAV';
import { SITE } from '../../../lib/site';
import type { Guide } from '../Guide';

export const AGENT_COSTS_GUIDE = {
  path: SITE.guides.costs,
  title: 'How to control the cost of coding agents',
  navLabel: GUIDE_NAV.costs,
  description:
    'Keep coding agent spend under control with a limit on each run and session, a choice between pausing and warning, and a monthly cap on each provider.',
  summary: 'Limits on runs and sessions, pause or warn, and a monthly cap for each provider.',
  definition:
    'To control what coding agents cost, put a limit on every run and session, a monthly cap on every provider, and watch the spend while the agents work. Goodboy pauses a run at its limit or only warns, as you choose, and warns before a provider reaches its cap.',
  sections: [
    {
      id: 'three-levels',
      heading: 'Three places to set a limit',
      paragraphs: [
        'Spend is bounded where it starts, where it adds up and where it is billed. That gives three limits: one for a run, one for a session and one for each provider each month.',
        'The smallest limit pauses the Lead. A session limit under the limit of the Lead lowers it, and the chip says which one wins.',
      ],
    },
    {
      id: 'run-limit',
      heading: 'Set a limit on a run',
      paragraphs: [
        'The start form has a Limit chip. Its popover lists $5, $10 and $25 beside the default, with Other amount and No limit. The run gets exactly the amount the chip shows, and No limit means no limit, even when the workspace has a default.',
        'The default for every new run is set once per workspace, on the Every run tab of Workflows. A running conversation shows its limit under the title, and you can raise, change or remove it there, with Undo.',
        'A Lead stops at its limit with The run reached its limit and offers Raise limit.',
      ],
      links: [
        { label: 'One start form', href: `${SITE.doc('start')}#one-start-form` },
        { label: 'Every run', href: `${SITE.doc('workflows')}#every-run` },
        { label: 'Limit', href: `${SITE.doc('workflows')}#limit` },
        { label: 'Lead', href: `${SITE.doc('agents')}#lead` },
      ],
    },
    {
      id: 'pause-or-warn',
      heading: 'Pause or warn',
      paragraphs: [
        'A limit does one of two things, and you choose which. Pause workflows stops the run at the limit. Warn only keeps it going and tells you.',
        'Only a limit that pauses caps a Lead run of the session. A limit that only warns caps nothing, so pick it on purpose.',
        'Amounts take cents, such as 2.50.',
      ],
      links: [{ label: 'Limit', href: `${SITE.doc('workflows')}#limit` }],
    },
    {
      id: 'monthly-cap',
      heading: 'Cap each provider for the month',
      paragraphs: [
        'In Spend, open a provider, enter a monthly cap and the share of it where Goodboy warns you. Past that share, the next turn goes to another provider with room. Spend that reaches the cap counts as over it.',
        'The month follows your local calendar. A session limit and a workflow limit trip at the same point, with the session warning at 80 percent.',
      ],
      links: [
        {
          label: 'Monthly cap and budget alert',
          href: `${SITE.doc('providers')}#monthly-cap-and-budget-alert`,
        },
        {
          label: 'Fallback when a limit is hit',
          href: `${SITE.doc('providers')}#fallback-when-a-limit-is-hit`,
        },
      ],
    },
    {
      id: 'see-spend',
      heading: 'See the spend while it happens',
      paragraphs: [
        'The cost in the top bar opens Spend. Impact shows what Goodboy got done and what it cost over 7 days, 30 days or all time, and Agents shows which roles did the work, on which models and at which effort.',
        'A chip in the top bar shows how much of your Claude and Codex plans is left, as the tighter of the 5-hour window and the week. Copilot is billed in premium requests, so its turns show that count in place of a cost.',
        'The cost on screen is an estimate from provider prices, measured on your machine.',
      ],
      links: [
        { label: 'Impact', href: `${SITE.doc('providers')}#impact` },
        {
          label: 'Usage limits chip',
          href: `${SITE.doc('providers')}#usage-limits-chip`,
        },
      ],
    },
    {
      id: 'runaways',
      heading: 'Catch a run that goes in circles',
      paragraphs: [
        'A few health checks stop a Lead, each with its sentence on the page. One of them stops it when agents come back to it six times in 30 minutes with no limit set.',
      ],
      links: [{ label: 'Lead', href: `${SITE.doc('agents')}#lead` }],
    },
  ],
  faq: {
    heading: 'Common questions',
    items: [
      {
        question: 'What happens when a run reaches its limit?',
        answer:
          'With Pause workflows the run stops and offers Raise limit. With Warn only it keeps going and you get a warning.',
      },
      {
        question: 'Does Goodboy bill me for the agents?',
        answer:
          'No. Goodboy runs the agents you already pay for, so the bill stays with each provider. The limits and caps here are yours, set inside Goodboy.',
      },
      {
        question: 'Is the cost on screen exact?',
        answer: 'It is an estimate from provider prices, measured for every turn on your machine.',
      },
      {
        question: 'Can I run without a limit?',
        answer:
          'Yes. Choose No limit in the Limit chip and the run starts with none, even when the workspace has a default.',
      },
    ],
  },
  cta: {
    heading: 'Set a limit before the next run',
    lead: 'Install Goodboy, open Workflows then Every run, and choose the limit new runs start from.',
  },
  related: [SITE.guides.parallel, SITE.guides.together, SITE.guides.glossary],
} as const satisfies Guide;
