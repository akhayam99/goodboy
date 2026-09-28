import './AlsoIn.css';
import { Eyebrow } from '../components/Eyebrow';
import { revealStyle } from '../components/revealStyle';
import { ALSO_IN } from '../data/alsoIn';
import { SITE } from '../site';

const ROWS_PER_STEP = 2;

export const AlsoIn = () => (
  <section className="alsoIn" id="also" aria-labelledby="also-title">
    <div className="shell">
      <div className="alsoInner">
        <div className="alsoHead">
          <Eyebrow text="All features" kind="page" />
          <h2 id="also-title" className="beatHeading">
            Also in Goodboy
          </h2>
        </div>
        <ul className="alsoList">
          {ALSO_IN.map((row, index) => (
            <li
              key={row.title}
              data-reveal
              style={revealStyle({ index: Math.floor(index / ROWS_PER_STEP) })}
            >
              <a className="alsoRow" href={`${SITE.featureGuide}#${row.anchor}`}>
                <span className="alsoText">
                  <span className="alsoTitle">{row.title}</span>
                  <span className="alsoLine">{row.line}</span>
                </span>
                <span className="alsoArrow" aria-hidden="true">
                  →
                </span>
              </a>
            </li>
          ))}
        </ul>
        <a className="textLink" href={SITE.featureGuide}>
          Read every feature, with pictures <span aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  </section>
);
