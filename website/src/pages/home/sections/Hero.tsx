import './Hero.css';
import type { CSSProperties } from 'react';
import { BrandMark } from '../../../components/BrandIcons';
import { Eyebrow } from '../../../components/Eyebrow';
import { HeroShot } from '../../../components/HeroShot';
import { ProviderLine } from '../../../components/ProviderLine';
import { StarButton } from '../../../components/StarButton';
import { StarCount } from '../../../components/StarCount';
import { useDownloads } from '../../../hooks/useDownloads';
import { downloadTrack } from '../../../lib/downloadTrack';
import { SITE } from '../../../lib/site';
import { trackAttributes } from '../../../lib/trackAttributes';

type RiseStyle = CSSProperties & {
  readonly '--i': number;
};

const rise = (index: number): RiseStyle => ({ '--i': index });

export const Hero = () => {
  const { platform, urls, versions, primary } = useDownloads();

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="shell">
        <div className="heroCopy">
          <Eyebrow text="Free desktop ADE, built in public" kind="page" className="rise" />
          <h1 id="hero-title" className="display rise" style={rise(1)}>
            Give every task a structure to work in
          </h1>
          <p className="lead rise" style={rise(2)}>
            Goodboy runs coding agents side by side on your own repositories, one session for each
            goal.
          </p>
          <div className="ctaRow onlyFine rise" style={rise(3)}>
            <a
              className="btn"
              href={primary.href}
              data-download
              {...downloadTrack({
                os: primary.os,
                packageName: primary.packageName,
                location: 'hero',
                version: primary.version,
              })}
            >
              {primary.label}
            </a>
            <a
              className="btn ghost"
              href={SITE.repo}
              data-star
              {...trackAttributes({ event: 'star_click', params: { cta_location: 'hero' } })}
            >
              <BrandMark brand="github" size={18} />
              Star on GitHub
              <StarCount />
            </a>
            <span className="heroMeta">No account needed</span>
            {platform === 'other' ? (
              <a
                className="heroAlt"
                href={urls.appimage}
                data-download
                {...downloadTrack({
                  os: 'linux',
                  packageName: 'appimage',
                  location: 'hero',
                  version: versions.appimage,
                })}
              >
                Linux build
              </a>
            ) : null}
            <a
              className="heroFeatures"
              href={SITE.demo}
              {...trackAttributes({ event: 'demo_click', params: { cta_location: 'hero' } })}
            >
              Try the live demo
              <span aria-hidden="true">→</span>
            </a>
          </div>
          <div className="ctaRow onlyCoarse rise" style={rise(3)}>
            <StarButton location="hero" />
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
          <HeroShot />
        </div>
      </div>
    </section>
  );
};
