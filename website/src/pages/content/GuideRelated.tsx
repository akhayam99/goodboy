import { SITE } from '../../lib/site';
import { ADE_GUIDE } from './adeGuide';
import { GuideLinkList } from './GuideLinkList';
import { guidesOfPaths } from './guides/guidesOfPaths';

type Props = {
  readonly related: readonly string[];
};

export const GuideRelated = ({ related }: Props) => (
  <section className="guideSection" aria-labelledby="guide-related">
    <div className="prose">
      <h2 id="guide-related">Keep reading</h2>
      <p>
        This guide is part of <a href={SITE.ade}>{ADE_GUIDE.title}</a>
      </p>
      <GuideLinkList guides={guidesOfPaths({ paths: related })} />
    </div>
  </section>
);
