import './Hero.css';
import type { CSSProperties } from 'react';
import { BrandMark } from '../components/BrandIcons';
import { Eyebrow } from '../components/Eyebrow';
import { ProviderLine } from '../components/ProviderLine';
import { StarButton } from '../components/StarButton';
import { StarCount } from '../components/StarCount';
import { SessionMock } from '../components/mocks/SessionMock';
import { useDownloads } from '../hooks/useDownloads';
import { SITE } from '../site';

type RiseStyle = CSSProperties & {
  readonly '--i': number;
};

const rise = (index: number): RiseStyle => ({ '--i': index });

export const Hero = () => {
  const { platform, urls, primary } = useDownloads();

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="shell">
        <div className="heroCopy">
          <Eyebrow text="Free desktop ADE, built in public" kind="page" className="rise" />
          <h1 id="hero-title" className="display rise" style={rise(1)}>
            Give your agents a structure to work in
          </h1>
          <p className="lead rise" style={rise(2)}>
            One app to plan, run and review your code, with the subscriptions you already have.
          </p>
          <div className="ctaRow onlyFine rise" style={rise(3)}>
            <a className="btn" href={primary.href} data-download>
              {primary.label}
            </a>
            <a className="btn ghost" href={SITE.repo} data-star>
              <BrandMark brand="github" size={18} />
              Star on GitHub
              <StarCount />
            </a>
            <span className="heroMeta">No account needed</span>
            {platform === 'other' ? (
              <a className="heroAlt" href={urls.appimage} data-download>
                Linux build
              </a>
            ) : null}
            <a className="heroFeatures" href={SITE.features}>
              Explore the features
              <span aria-hidden="true">→</span>
            </a>
          </div>
          <div className="ctaRow onlyCoarse rise" style={rise(3)}>
            <StarButton />
            <span className="heroMeta">No account needed</span>
            <a className="heroFeatures" href={SITE.features}>
              Explore the features
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
        <div className="rise" style={rise(4)}>
          <ProviderLine />
        </div>
        <div className="heroFrame rise" style={rise(5)}>
          <SessionMock />
        </div>
      </div>
    </section>
  );
};
