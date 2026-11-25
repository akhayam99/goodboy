import type { Crumb } from '../../lib/Crumb';
import type { Guide } from './Guide';
import { ContentPage } from './ContentPage';
import { GuideCta } from './GuideCta';
import { GuideFaq } from './GuideFaq';
import { GuideRelated } from './GuideRelated';
import { GuideSectionView } from './GuideSectionView';

type Props = {
  readonly guide: Guide;
  readonly crumbs: readonly Crumb[];
};

export const GuidePage = ({ guide, crumbs }: Props) => (
  <ContentPage crumbs={crumbs} title={guide.title} lead={guide.definition}>
    {guide.sections.map((section) => (
      <GuideSectionView key={section.id} section={section} />
    ))}
    {guide.faq === undefined ? null : <GuideFaq faq={guide.faq} />}
    <GuideRelated related={guide.related} />
    <GuideCta cta={guide.cta} />
  </ContentPage>
);
