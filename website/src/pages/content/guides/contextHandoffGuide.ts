import { GUIDE_NAV } from '../../../lib/GUIDE_NAV';
import { SITE } from '../../../lib/site';
import type { Guide } from '../Guide';

export const CONTEXT_HANDOFF_GUIDE = {
  path: SITE.guides.handoff,
  title: 'Context handoff between coding agents',
  navLabel: GUIDE_NAV.handoff,
  description:
    'Context engineering for coding agents: what to hand the next agent (goal, decisions, running summary), who reads what, and how Goodboy keeps the brief small.',
  summary: 'What to hand the next agent, who reads it and how the brief stays small.',
  definition:
    'A context handoff gives the next coding agent what the last one learned: the goal, the decisions already made and where the work stands. Goodboy keeps those three with the session, so a new agent starts informed instead of from a blank chat.',
  sections: [
    {
      id: 'what-to-hand-over',
      heading: 'What to hand over',
      paragraphs: [
        'A whole chat is the wrong thing to pass on. It is long, it holds dead ends, and the next agent may run on a model that does not keep the conversation. Pass a brief.',
        'The brief has three parts. The goal says what the session is for. The decisions say what is settled. The running summary says where the work stands and what comes next.',
        'Each workflow step in Goodboy starts from a short brief and not from the whole previous chat.',
      ],
      links: [{ label: 'Shared context', href: SITE.doc('context') }],
    },
    {
      id: 'decisions',
      heading: 'Record a decision once',
      paragraphs: [
        'A decision is a choice you settled, such as which queue the retries run on. Record it once and the agents after it read it, so nobody reopens it.',
        'Each decision gets a number. Replacing or withdrawing one needs a reason, and the reason stays next to it. Changed decisions show as Added, Reworded or Withdrawn, and Undo stays while the Context tab is open.',
      ],
      links: [
        { label: 'Decisions', href: `${SITE.doc('context')}#decisions` },
        {
          label: 'See why each decision was made',
          href: `${SITE.doc('context')}#see-why-each-decision-was-made`,
        },
      ],
    },
    {
      id: 'running-summary',
      heading: 'Keep a running summary',
      paragraphs: [
        'The summary opens on the State: a count of blockers or of steps left, and its first sentence. Next lists the steps in order, and Learned lists the facts the work found out, written for the next agent.',
        'The Context tab shows the goal, the decisions and the summary in one place, and Copy context takes them with you.',
      ],
      links: [
        { label: 'Running summary', href: `${SITE.doc('context')}#running-summary` },
        { label: 'Context tab', href: `${SITE.doc('context')}#context-tab` },
      ],
    },
    {
      id: 'who-reads-what',
      heading: 'Choose who reads what',
      paragraphs: [
        'Planners, implementers, reviewers, debuggers and resolvers read the decisions. Scouts and docs agents do not. Agents the Lead starts read only their brief. You always see everything.',
        'Change visibility in a card menu lists the roles that receive that part, and What Goodboy sends shows what each agent gets before it starts.',
      ],
      links: [{ label: 'Who receives what', href: `${SITE.doc('context')}#who-receives-what` }],
    },
    {
      id: 'size-limit',
      heading: 'Keep the brief small',
      paragraphs: [
        'Each part of the brief has its own size, and when the decisions run over, the newest are kept. What Goodboy sends shows each part in tokens and each row against the limit of the brief.',
        'When a step runs on a model that does not keep the conversation, such as Cursor, Codex or Gemini, its history arrives as at most 8,000 estimated tokens, with the original request always included. If the summary fails, Goodboy tries the other models you allow, and only then keeps the start and the end of the chat and marks the brief as degraded, with Retry.',
      ],
      links: [
        { label: 'Context budgets', href: `${SITE.doc('context')}#context-budgets` },
        { label: 'Step handoff summary', href: `${SITE.doc('workflows')}#step-handoff-summary` },
      ],
    },
    {
      id: 'plans',
      heading: 'Hand a plan to the implementer',
      paragraphs: [
        'A plan goes straight to the next agent. It moves from Ready to run to Ran and shows which agent used it.',
      ],
      links: [
        {
          label: 'Plans handed to the next agent',
          href: `${SITE.doc('context')}#plans-handed-to-the-next-agent`,
        },
      ],
    },
  ],
  faq: {
    heading: 'Common questions',
    items: [
      {
        question: 'What is context engineering for coding agents?',
        answer:
          'It is choosing what each agent reads: the goal, the decisions and a short summary, in a size that fits. Goodboy shows what each agent gets before it starts.',
      },
      {
        question: 'Do all agents read every decision?',
        answer:
          'No. Planners, implementers, reviewers, debuggers and resolvers do. Scouts, docs agents and agents the Lead starts do not.',
      },
      {
        question: 'Can I edit a decision?',
        answer:
          'Yes. Open it to edit or remove it, and Undo stays while the Context tab is open. A replaced or withdrawn decision keeps its reason.',
      },
      {
        question: 'Does the context leave my computer?',
        answer:
          'Your tasks, decisions and settings stay on your computer. An agent receives its brief like any prompt, and the prompt goes to the provider you chose.',
      },
    ],
  },
  cta: {
    heading: 'Stop retelling the story to every agent',
    lead: 'Install Goodboy and start a session. Record a decision and the next agent reads it.',
  },
  related: [SITE.guides.parallel, SITE.guides.together, SITE.guides.glossary],
} as const satisfies Guide;
