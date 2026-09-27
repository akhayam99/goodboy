import { SeeHow } from '../components/SeeHow';
import { Shot } from '../components/Shot';
import { SESSION } from '../figures';
import { SITE } from '../site';

export const Hero = () => (
  <section id="hero" aria-labelledby="h2-hero">
    <div className="wrap">
      <div className="heroCopy">
        <p className="eyebrow">A desktop app for coding agents, and much more</p>
        <h1 id="h2-hero">Stop re&#8209;explaining yourself</h1>
        <p className="sub">
          Goodboy is an ADE, an agentic development environment. Use Claude, Codex, Cursor and more
          in the same session, give each chat one job, and keep the whole task in one place.
        </p>
        <div className="ctaRow">
          <a className="btn" href="#install">
            Install
          </a>
          <a className="btn ghost" href={SITE.repo}>
            Star on GitHub
          </a>
        </div>
        <SeeHow anchor="inside-a-session" />
      </div>
    </div>
    <div className="wrap">
      <Shot figure={SESSION} isEager />
    </div>
  </section>
);
