import { delay } from '../components/Reveal';

type FaqItem = {
  readonly q: string;
  readonly a: string;
};

const FAQS: readonly FaqItem[] = [
  {
    q: 'Do I need to be a developer to use this?',
    a: 'The deep parts, worktrees, branches, diffs, pull requests, expect a git repository. Point Goodboy at one and you get the full flow. Point it at a plain folder instead and agents still run on it, just without worktrees, branches, or PRs.',
  },
  {
    q: 'Is it really free? What is the catch?',
    a: 'MIT license, no paywall, no account, every feature included from the first launch. Nothing in the app is phoned home: what it tracks about your work stays in the file on your own computer. This website runs its own analytics; the app does not. The only thing you pay for is the subscription you already have.',
  },
  {
    q: 'Will this cost me anything on top of what I already pay?',
    a: 'No new bill. Goodboy runs on the Claude, Cursor, Codex, or other subscription you already have. The numbers you see in the app are what that work would have cost by the token, not a separate charge.',
  },
  {
    q: 'Do I need API keys?',
    a: 'For most providers, no. Claude, Cursor, Codex, Gemini and OpenCode reuse the login you already have with each CLI or app. OpenRouter and Moonshot are API-only, so those two need a key, kept in your OS keychain and never written to disk.',
  },
  {
    q: 'Do I need to connect every provider to start?',
    a: 'No. One connected CLI is enough to get going. Connect more later if you want to spread work across models or compare them on the same task.',
  },
  {
    q: 'Where does my data go?',
    a: 'Conversations, plans, decisions and PR state sit in a local SQLite file on your machine. The app itself has no backend and no account. Prompts and responses go straight from you to whichever provider you picked, the same path as running their CLI yourself.',
  },
  {
    q: 'What if I do not like what the agents did?',
    a: 'You read the diff before anything ships. Agents open a draft pull request; they never merge it themselves. If you want out of a session entirely, deleting it removes its branch and worktree too, so your main branch never sees it.',
  },
  {
    q: 'Which platforms does it run on?',
    a: 'macOS and Linux. On a Mac it is one build for both Intel and Apple Silicon, or Homebrew if you prefer, and it keeps itself up to date. On Linux take the AppImage, the .deb or the .rpm, x86_64 on Ubuntu 24.04 or Debian 13 and newer, and pick up the next version from the release page yourself: updating in place is macOS only so far. Windows means building from source for now.',
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
