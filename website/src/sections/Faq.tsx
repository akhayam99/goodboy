import './Faq.css';
import { Chapter } from '../components/Chapter';
import { FAQS } from '../data/faqs';

export const Faq = () => (
  <Chapter
    id="faq"
    isBand
    head={{ eyebrow: 'Questions', eyebrowKind: 'page', heading: 'Before you install' }}
  >
    <div className="faq">
      {FAQS.map((item, index) => (
        <details key={item.question} open={index === 0}>
          <summary>{item.question}</summary>
          <p>{item.answer}</p>
        </details>
      ))}
    </div>
  </Chapter>
);
