import './Hero.css';
import type { CSSProperties } from 'react';
import { Eyebrow } from '../components/Eyebrow';
import { Frame } from '../components/Frame';
import { HERO_SESSION } from '../figures';
import { SITE } from '../site';

type RiseStyle = CSSProperties & {
  readonly '--i': number;
};

const rise = (index: number): RiseStyle => ({ '--i': index });

export const Hero = () => (
  <section className="hero" aria-labelledby="hero-title">
    <div className="shell">
      <div className="heroCopy">
        <Eyebrow text="Agentic development environment" kind="page" className="rise" />
        <h1 id="hero-title" className="display rise" style={rise(1)}>
          A development environment that structures agent work
        </h1>
        <p className="lead rise" style={rise(2)}>
          Every task keeps its goal, decisions and summary, so each agent starts briefed. Runs on
          the providers you already use.
        </p>
        <div className="ctaRow rise" style={rise(3)}>
          <a className="btn" href={SITE.latest}>
            Download for macOS
          </a>
          <a className="btn ghost" href={SITE.repo}>
            View on GitHub
          </a>
          <span className="heroMeta">Free for macOS and Linux, no account needed.</span>
        </div>
      </div>
      <div className="heroFrame rise" style={rise(4)}>
        <Frame figure={HERO_SESSION} cap={640} isEager />
      </div>
    </div>
  </section>
);
