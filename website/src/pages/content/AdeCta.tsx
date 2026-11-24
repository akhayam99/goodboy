import { BrandMark } from '../../components/BrandIcons';
import { StarCount } from '../../components/StarCount';
import { SITE } from '../../lib/site';
import { trackAttributes } from '../../lib/trackAttributes';
import { ADE_GUIDE } from './adeGuide';

export const AdeCta = () => (
  <section className="adeSection" aria-labelledby="ade-cta">
    <div className="prose">
      <h2 id="ade-cta">{ADE_GUIDE.cta.heading}</h2>
      <p>{ADE_GUIDE.cta.lead}</p>
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
