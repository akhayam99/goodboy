import { delay } from '../components/Reveal';
import { SITE } from '../site';

export const Privacy = () => (
  <section className="block" id="privacy" aria-labelledby="h2-privacy">
    <div className="wrap">
      <div className="blockHead">
        <h2 className="rv" id="h2-privacy">
          Everything stays on your computer
        </h2>
        <p className="sub rv" style={delay(80)}>
          Your tasks, chats, plans and stats live in one file on your computer.{' '}
          <b>No account, no server, nothing leaves your computer.</b>
        </p>
        <p className="caption rv" style={delay(120)}>
          That is the app. This page is not the app: it runs Google Tag Manager and Vercel's
          analytics and speed tools to see how the site itself is doing. The desktop app carries no
          telemetry and never phones home, by policy.
        </p>
      </div>

      <div className="dbcard rv" style={delay(160)}>
        <div className="dhead">
          <b>~/.goodboy/data.db</b>
          <span>
            one SQLite file, an ordinary database sitting on your disk. Copy it and your history
            comes with you.
          </span>
        </div>
        <div className="dtbl">
          <span className="t">workspaces</span>
          <span className="t">sessions</span>
          <span className="t">provider_runs</span>
          <span className="t">messages</span>
          <span className="t">context_slots</span>
          <span className="t">plans</span>
          <span className="t">telemetry (stays here)</span>
          <span className="t">skills</span>
          <span className="t">settings</span>
        </div>
      </div>
      <p className="caption rv" style={delay(200)}>
        Your prompts go straight from your computer to the provider you picked. If you use an API
        key, it sits in the same keychain as your passwords.
      </p>
      <div className="pledge rv" style={delay(220)}>
        <span>every feature free</span>
        <span>open source (MIT)</span>
        <span>stats stay on your computer</span>
        <span>delete the file and the data is gone</span>
      </div>
      <a className="more rv" style={delay(260)} href={SITE.privacy}>
        Read the full pledge <span className="arr">→</span>
      </a>
    </div>
  </section>
);
