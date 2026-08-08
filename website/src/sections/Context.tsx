import { useEffect, useState } from 'react';
import { delay, prefersReducedMotion, useInViewOnce } from '../components/Reveal';
import { SITE } from '../site';

type OvState = {
  readonly sum: string;
  readonly need: string;
  readonly stage: string;
  readonly stageCls: string;
  readonly cost: string;
};

const OV_STATES: { readonly a: OvState; readonly b: OvState } = {
  a: {
    sum: 'Archive endpoint done, list view wired, empty-state copy still ahead.',
    need: 'Nothing right now. Two agents running.',
    stage: 'running',
    stageCls: 'pill stage-run',
    cost: '$1.32',
  },
  b: {
    sum: 'Empty state shipped, 12 tests green, PR #491 open as a draft.',
    need: 'One question: archive read notifications too, or only unread?',
    stage: 'needs you',
    stageCls: 'pill stage-you',
    cost: '$1.61',
  },
};

export const Context = () => {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const [late, setLate] = useState(false);

  useEffect(() => {
    if (!inView || prefersReducedMotion()) return;
    const t = setTimeout(() => setLate(true), 1800);
    return () => clearTimeout(t);
  }, [inView]);

  const s = late ? OV_STATES.b : OV_STATES.a;

  return (
    <section className="block" id="context" aria-labelledby="h2-context">
      <div className="wrap">
        <div className="blockHead">
          <h2 className="rv" id="h2-context">
            Close the laptop, keep your place
          </h2>
          <p className="sub rv" style={delay(80)}>
            Open a card and the whole task is there:{' '}
            <b>the goal, the decisions, the last thing that happened</b>. Four hours or four days
            later, the overview catches you up.
          </p>
        </div>

        <div className="appframe rv" style={delay(160)} ref={ref}>
          <div className="tbar">
            <span className="tl r" />
            <span className="tl y" />
            <span className="tl g" />
            <span className="tname">goodboy, task: LIN-241</span>
          </div>
          <div className="ovtabs" role="group" aria-label="Two moments of the same task">
            <button
              className={`ttab${late ? '' : ' on'}`}
              aria-pressed={!late}
              onClick={() => setLate(false)}
            >
              11:30, you leave
            </button>
            <button
              className={`ttab${late ? ' on' : ''}`}
              aria-pressed={late}
              onClick={() => setLate(true)}
            >
              14:05, you are back
            </button>
          </div>
          <div className="ovmeta">
            <span className={s.stageCls}>{s.stage}</span>
            <span className="pill">LIN-241</span>
            <span className="cost" style={{ marginLeft: 0 }}>
              {s.cost}
            </span>
            <span className="who">claude and gemini on it</span>
          </div>
          <div className="ovgrid">
            <div className="ovslot">
              <h5>Goal</h5>
              <p>Ship LIN-241, bulk archive for notifications.</p>
            </div>
            <div className="ovslot">
              <h5>Decisions</h5>
              <p>Soft delete only. Batches of 500. No schema change.</p>
            </div>
            <div className={`ovslot${late ? ' chg' : ''}`}>
              <h5>Summary</h5>
              <p>{s.sum}</p>
            </div>
            <div className={`ovslot${late ? ' chg' : ''}`}>
              <h5>Needs you</h5>
              <p>{s.need}</p>
              {late && <span className="mockbtn">Answer</span>}
            </div>
          </div>
        </div>
        <a className="more rv" style={delay(220)} href={SITE.vision}>
          Why the task comes first <span className="arr">→</span>
        </a>
      </div>
    </section>
  );
};
