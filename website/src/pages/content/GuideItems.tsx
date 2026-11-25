import type { GuideItem } from './Guide';
import { GuideLinks } from './GuideLinks';

type Props = {
  readonly items: readonly GuideItem[];
};

export const GuideItems = ({ items }: Props) => (
  <>
    {items.map((item) => (
      <div key={item.id} className="guideItem">
        <h3 id={item.id}>{item.title}</h3>
        {item.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {item.links.length > 0 ? <GuideLinks links={item.links} /> : null}
      </div>
    ))}
  </>
);
