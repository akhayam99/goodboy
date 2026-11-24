import { ADE_GUIDE } from './adeGuide';

export const AdeFaq = () => (
  <section className="adeSection" aria-labelledby="ade-faq">
    <div className="prose">
      <h2 id="ade-faq">{ADE_GUIDE.faq.heading}</h2>
      {ADE_GUIDE.faq.items.map((item) => (
        <div key={item.question} className="adeJob">
          <h3>{item.question}</h3>
          <p>{item.answer}</p>
        </div>
      ))}
    </div>
  </section>
);
