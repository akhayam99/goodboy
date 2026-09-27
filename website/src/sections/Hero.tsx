import { Shot } from '../components/Shot';
import { S01 } from '../figures';
import { SITE } from '../site';

export const Hero = () => (
  <section id="hero" aria-labelledby="h2-hero">
    <div className="wrap">
      <div className="heroCopy">
        <p className="eyebrow">A desktop app for coding agents, and much more</p>
        <h1 id="h2-hero">Stop re&#8209;explaining yourself</h1>
        <p className="sub">
          Goodboy is an ADE, an agentic development environment: agents from the providers you
          connect do the work, and Goodboy gives that work its structure. Each task keeps its goal,
          its decisions and where it stands, so the next agent starts briefed and you can tell at a
          glance what needs you.
        </p>
        <div className="ctaRow">
          <a className="btn" href="#install">
            Install
          </a>
          <a className="btn ghost" href={SITE.repo}>
            Star on GitHub
          </a>
        </div>
      </div>
      <Shot figure={S01} isEager />
    </div>
  </section>
);
