import { delay } from '../components/Reveal';

type FaqItem = {
  readonly q: string;
  readonly a: string;
};

const FAQS: readonly FaqItem[] = [
  {
    q: 'Do I need to be a developer?',
    a: 'Goodboy is at its best on a code project, where you get a branch, a diff and a pull request out of every task. Point it at a plain folder and agents still work on it.',
  },
  {
    q: 'Is it really free, and what is the catch?',
    a: 'Free and open source, every feature included from the first launch. No account, no paid tier waiting for you further down.',
  },
  {
    q: 'Will it cost me anything on top of what I already pay?',
    a: 'No new bill. It works through the subscriptions you already have.',
  },
  {
    q: 'Do I need to connect every provider?',
    a: 'One is enough to start. Connect a second when you want to spread the work around, or to keep going after you hit a limit.',
  },
  {
    q: 'Where does my data go?',
    a: 'Everything the app knows about your work stays on your computer. Your prompts go straight from you to the provider you picked.',
  },
  {
    q: 'What if I do not like what the agents did?',
    a: 'You read the diff before anything lands. Agents open the pull request, merging waits for you.',
  },
  {
    q: 'Which platforms does it run on?',
    a: 'macOS and Linux today. One build for Mac, packages for Linux.',
  },
];

export const Faq = () => (
  <section className="block alt" id="faq" aria-labelledby="h2-faq">
    <div className="wrap">
      <div className="blockHead">
        <h2 className="rv" id="h2-faq">
          Questions people ask before they install
        </h2>
        <p className="sub rv" style={delay(80)}>
          The stuff that comes up first, answered straight.
        </p>
      </div>
      <div className="faq">
        {FAQS.map((item, i) => (
          <details key={item.q} className="rv" style={delay(i * 40)} open={i === 0}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  </section>
);
