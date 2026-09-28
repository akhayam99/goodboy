import './Hero.css';
import type { CSSProperties } from 'react';
import { Eyebrow } from '../components/Eyebrow';
import { Stage } from '../components/Stage';
import { StarCta } from '../components/StarCta';
import { Board } from '../components/mocks/Board';
import { SITE } from '../site';

type RiseStyle = CSSProperties & {
  readonly '--i': number;
};

type RiseParams = {
  readonly index: number;
};

const rise = ({ index }: RiseParams): RiseStyle => ({ '--i': index });

export const Hero = () => (
  <section className="hero" aria-labelledby="hero-title">
    <div className="shell">
      <div className="heroCopy">
        <Eyebrow text="Desktop ADE for macOS and Linux" kind="page" className="rise" />
        <h1 id="hero-title" className="display rise" style={rise({ index: 1 })}>
          Run many coding agents at once
        </h1>
        <p className="lead rise" style={rise({ index: 2 })}>
          Goodboy is a free desktop app that puts each one on its own task and branch, on the plans
          and keys you already pay for.
        </p>
        <div className="ctaRow onlyFine rise" style={rise({ index: 3 })}>
          <a className="btn" href={SITE.latest} data-download>
            Download for macOS
          </a>
          <a className="btn ghost" href={SITE.repo}>
            View on GitHub
          </a>
          <span className="heroMeta">No account needed.</span>
        </div>
        <div className="heroPhone rise" style={rise({ index: 3 })}>
          <StarCta note="Goodboy runs on macOS and Linux. Open this page on your computer to install it." />
        </div>
      </div>
      <div className="heroStage">
        <Stage isRevealed={false}>
          <Board />
        </Stage>
      </div>
    </div>
  </section>
);
