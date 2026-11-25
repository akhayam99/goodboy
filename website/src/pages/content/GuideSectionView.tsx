import type { GuideSection } from './Guide';
import { GuideItems } from './GuideItems';
import { GuideLinks } from './GuideLinks';
import { GuideSteps } from './GuideSteps';

type Props = {
  readonly section: GuideSection;
};

export const GuideSectionView = ({ section }: Props) => (
  <section className="guideSection" aria-labelledby={section.id}>
    <div className="prose">
      <h2 id={section.id}>{section.heading}</h2>
      {section.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {section.steps === undefined ? null : <GuideSteps steps={section.steps} />}
      {section.items === undefined ? null : <GuideItems items={section.items} />}
      {section.links === undefined ? null : <GuideLinks links={section.links} />}
    </div>
  </section>
);
