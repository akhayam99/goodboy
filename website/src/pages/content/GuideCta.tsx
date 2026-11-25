import { BrandMark } from '../../components/BrandIcons';
import { StarCount } from '../../components/StarCount';
import { SITE } from '../../lib/site';
import { trackAttributes } from '../../lib/trackAttributes';
import type { GuideCta as GuideCtaData } from './Guide';

type Props = {
  readonly cta: GuideCtaData;
};

export const GuideCta = ({ cta }: Props) => (
  <section className="guideSection" aria-labelledby="guide-cta">
    <div className="prose">
      <h2 id="guide-cta">{cta.heading}</h2>
      <p>{cta.lead}</p>
    </div>
    <div className="ctaRow">
      <a className="btn" href="/#install">
        Download Goodboy
      </a>
      <a
        className="btn ghost"
        href={SITE.repo}
        data-star
        {...trackAttributes({ event: 'star_click', params: { cta_location: 'guide' } })}
      >
        <BrandMark brand="github" size={18} />
        Star on GitHub
        <StarCount />
      </a>
      <a className="refLink" href={SITE.features}>
        All features
      </a>
    </div>
  </section>
);
