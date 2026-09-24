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
    q: 'Is it really free?',
    a: 'Yes. Free and source-available, with no account to create.',
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
    a: 'Agents open pull requests as drafts, and you read the diff before you merge.',
  },
  {
    q: 'Which platforms does it run on?',
    a: 'macOS and Linux. Download the Mac app from this page, the Linux builds are on the release page.',
  },
];

export const Faq = () => (
  <section className="block alt" id="faq" aria-labelledby="h2-faq">
    <div className="wrap split splitSticky">
      <div className="blockHead">
        <h2 className="rv" id="h2-faq">
          Questions people ask before they install
        </h2>
        <p className="sub rv" style={delay(80)}>
          The stuff that comes up first, answered straight.
        </p>
      </div>
      <div className="faq splitBody">
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
