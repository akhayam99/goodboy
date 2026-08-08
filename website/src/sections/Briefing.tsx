import { useEffect, useState } from 'react';
import { BrandMark, type BrandId } from '../components/BrandIcons';
import { delay, prefersReducedMotion, useToggleInView } from '../components/Reveal';
import { SITE } from '../site';

const AGENTS: readonly { readonly brand: BrandId; readonly name: string }[] = [
  { brand: 'anthropic', name: 'Claude' },
  { brand: 'codex', name: 'Codex' },
  { brand: 'cursor', name: 'Cursor' },
  { brand: 'gemini', name: 'Gemini' },
];

const LINES: readonly { readonly me: boolean; readonly text: string }[] = [
  { me: true, text: 'Pick up from the summary. Tests are red on logout.' },
  {
    me: false,
    text: 'Read the goal and decisions. The logout path drops the SQLite mirror; patching the adapter, keeping the flag.',
  },
  { me: false, text: 'Done. 14 tests green. Updated the summary for whoever comes next.' },
];

const Thread = ({ round }: { readonly round: number }) => {
  const [shown, setShown] = useState(prefersReducedMotion() ? LINES.length : 0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(LINES.length);
      return;
    }
    setShown(0);
    const timers = LINES.map((_, i) =>
      setTimeout(() => setShown((current) => Math.max(current, i + 1)), 350 + i * 900),
    );
    return () => timers.forEach(clearTimeout);
  }, [round]);

  return (
    <div className="tbody">
      {LINES.map((line, i) => (
        <div
          key={line.text}
          className={['msg', line.me ? 'me' : '', i < shown ? 'show' : '']
            .filter(Boolean)
            .join(' ')}
        >
          {line.text}
        </div>
      ))}
    </div>
  );
};

export const Briefing = () => {
  const { ref, inView } = useToggleInView<HTMLDivElement>();
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!inView || prefersReducedMotion()) {
      return;
    }
    const id = setInterval(() => setRound((current) => current + 1), 4600);
    return () => clearInterval(id);
  }, [inView]);

  const agent = AGENTS[round % AGENTS.length];
  const pulsing = inView && round > 0;

  return (
    <section className="block" id="briefing" aria-labelledby="h2-brief">
      <div className="wrap">
        <div className="blockHead">
          <h2 className="rv" id="h2-brief">
            The briefing belongs to the task, not the chat
          </h2>
          <p className="sub rv" style={delay(80)}>
            Write the goal once and <b>every agent that touches the task starts informed</b>. Swap
            models mid-task, step away for a day, come back: nothing needs re-explaining.
          </p>
        </div>

        <div className="duo rv" style={delay(160)} ref={ref}>
          <div className="slots">
            <div className={`slot${pulsing ? ' pulse' : ''}`}>
              <h5>Goal</h5>
              <p>Move session storage off localStorage, keep the migration reversible.</p>
            </div>
            <div className={`slot${pulsing ? ' pulse' : ''}`}>
              <h5>Decisions</h5>
              <p>Cookie and SQLite mirror. No new dependencies. Feature flag until v0.2.</p>
            </div>
            <div className={`slot${pulsing ? ' pulse' : ''}`}>
              <h5>Summary</h5>
              <p>Schema landed, adapter half done, tests red on the logout path.</p>
            </div>
          </div>
          <div className="thread">
            <div className="thead">
              <span className="pchip">
                <BrandMark brand={agent.brand} size={14} />
                {agent.name}
              </span>
              <span className="lbl">briefed from the summary</span>
            </div>
            <Thread round={round} />
          </div>
        </div>
        <p className="caption rv" style={delay(200)}>
          A chat tool drops the thread when you switch window or model. Goodboy keeps it with the
          task, whichever agent picks it up next.
        </p>
        <a className="more rv" style={delay(240)} href={`${SITE.vision}#shared-context`}>
          How shared context works <span className="arr">→</span>
        </a>
      </div>
    </section>
  );
};
