type FaqItem = {
  readonly q: string;
  readonly a: string;
};

const FAQS: readonly FaqItem[] = [
  {
    q: 'Do I need to be a developer?',
    a: 'Goodboy is at its best on a code project, where a task can end in a branch, a diff and a pull request. Point it at a plain folder and agents still work on it.',
  },
  {
    q: 'Is it really free?',
    a: 'Yes. Goodboy is a free desktop app, with no account to create.',
  },
  {
    q: 'Will it cost me anything on top of what I already pay?',
    a: 'No new bill from Goodboy. Agents run on the providers you connect, with the plan or key you already have.',
  },
  {
    q: 'Do I need to connect every provider?',
    a: 'One is enough to start. Connect a second when you want to spread the work around, or to give a turn somewhere to go when the first one hits a limit.',
  },
  {
    q: 'Where does my data go?',
    a: 'Your tasks, decisions and settings stay on your computer. Your prompts go from you to the provider you picked.',
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
  <section className="block" id="faq" aria-labelledby="h2-faq">
    <div className="wrap narrow">
      <h2 id="h2-faq">Questions people ask before they install</h2>
      <div className="faq">
        {FAQS.map((item, i) => (
          <details key={item.q} open={i === 0}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  </section>
);
