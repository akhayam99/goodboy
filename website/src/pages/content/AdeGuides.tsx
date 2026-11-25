import { ADE_GUIDE } from './adeGuide';
import { GuideLinkList } from './GuideLinkList';
import { GUIDES } from './guides/GUIDES';

export const AdeGuides = () => (
  <section className="guideSection" aria-labelledby="ade-guides">
    <div className="prose">
      <h2 id="ade-guides">{ADE_GUIDE.guides.heading}</h2>
      <p>{ADE_GUIDE.guides.intro}</p>
      <GuideLinkList guides={GUIDES} />
    </div>
  </section>
);
