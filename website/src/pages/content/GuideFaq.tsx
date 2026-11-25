import type { GuideFaq as GuideFaqData } from './Guide';

type Props = {
  readonly faq: GuideFaqData;
};

export const GuideFaq = ({ faq }: Props) => (
  <section className="guideSection" aria-labelledby="guide-faq">
    <div className="prose">
      <h2 id="guide-faq">{faq.heading}</h2>
      {faq.items.map((item) => (
        <div key={item.question} className="guideItem">
          <h3>{item.question}</h3>
          <p>{item.answer}</p>
        </div>
      ))}
    </div>
  </section>
);
