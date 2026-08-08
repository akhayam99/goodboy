import { delay } from '../components/Reveal';

type MoreCard = {
  readonly title: string;
  readonly body: string;
  readonly tagline: string;
};

const CARDS: ReadonlyArray<MoreCard> = [
  {
    title: 'A terminal of your own',
    body: "Every session keeps a real terminal, opened right in the agent's own copy of your code. Run a command yourself when it is faster than asking.",
    tagline: 'no separate window, no lost context',
  },
  {
    title: 'Turn a habit into a slash command',
    body: 'Write a skill once as a markdown file in your workspace, then call it with /name from chat. It runs the same way no matter which provider is doing the work.',
    tagline: 'one skill, every agent',
  },
  {
    title: 'How much room agents get',
    body: 'Pick a permission mode per session, from read-only planning to full access with no prompts, and every tool call an agent makes is logged with the decision behind it.',
    tagline: 'plan, edits, default, bypass',
  },
  {
    title: 'One composer, every shortcut',
    body: 'Type @ for an agent, # for a session, / for a skill, $ for a script, and the composer narrows to matches as you type.',
    tagline: 'no menus to hunt through',
  },
  {
    title: 'Check in from your phone',
    body: "An early companion, still in beta, pairs your phone with the desktop. Enough to start a workflow or merge a pull request while you're away from your desk.",
    tagline: 'beta, phone bridge',
  },
  {
    title: 'Plans that stick around',
    body: 'An agent writes its plan before touching your code, and it stays as a document you can read and edit, not a message buried in scrollback.',
    tagline: 'structured, not scrollback',
  },
];

export const AlsoInApp = () => (
  <section className="block" id="more" aria-labelledby="h2-more">
    <div className="wrap">
      <div className="blockHead">
        <h2 className="rv" id="h2-more">
          Also in the app
        </h2>
        <p className="sub rv" style={delay(80)}>
          The rest of the toolkit, still built for the same job: keep the task moving without
          pulling you into every step.
        </p>
      </div>
      <div className="mgrid">
        {CARDS.map((card, index) => (
          <div key={card.title} className="mcard rv" style={delay(index * 60)}>
            <h3>{card.title}</h3>
            <p>{card.body}</p>
            <span className="tagline">{card.tagline}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);
