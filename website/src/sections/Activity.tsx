import './Activity.css';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { delay, prefersReducedMotion, useToggleInView } from '../components/Reveal';
import { BrandMark } from '../components/BrandIcons';
import { SITE } from '../site';

type Lane = 'none' | 'solid' | 'dash';

type Grade = 'entry' | 'step';

type Run = 'off' | 'anchor' | 'thru' | 'step';

type Ev = {
  readonly at: number;
  readonly time: string;
  readonly gap: number;
  readonly bh: number;
  readonly grade: Grade;
  readonly tone: string;
  readonly glyph: ReactNode;
  readonly run: Run;
  readonly wash?: boolean;
  readonly action?: ReactNode;
  readonly body: ReactNode;
};

const BEATS = [
  240, 590, 890, 1180, 1540, 1920, 2210, 2520, 2860, 3170, 3510, 4490, 4840, 5150, 5490,
];

const AT_WORKFLOW = 2;
const AT_QUESTION = 11;
const AT_ANSWER = 12;
const AT_LAST = BEATS.length;

const rowStyle = (gap: number, bh: number) =>
  ({ '--gap': `${gap}px`, '--bh': `${bh}px` }) as CSSProperties;

const Stroke = ({ children }: { readonly children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

const PrGlyph = () => (
  <Stroke>
    <circle cx="6" cy="6" r="3" />
    <circle cx="18" cy="18" r="3" />
    <path d="M13 6h3a2 2 0 0 1 2 2v7" />
    <path d="M6 9v12" />
  </Stroke>
);

const EyeGlyph = () => (
  <Stroke>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Stroke>
);

const CommitGlyph = () => (
  <Stroke>
    <circle cx="12" cy="12" r="3.6" />
    <path d="M2 12h6.4" />
    <path d="M15.6 12H22" />
  </Stroke>
);

const CheckGlyph = () => (
  <Stroke>
    <path d="M4.5 12.6 9.5 17.6 19.5 6.8" />
  </Stroke>
);

const LampGlyph = () => (
  <Stroke>
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .8 1.6v.6h5.6v-.6c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3Z" />
    <path d="M9.6 19h4.8" />
    <path d="M10.6 21.5h2.8" />
  </Stroke>
);

const AskGlyph = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    fillOpacity="0.18"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .9-1 1.6v.3" fill="none" />
    <path d="M12 17h.01" fill="none" />
  </svg>
);

const PlanGlyph = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    fillOpacity="0.18"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <rect x="9" y="2" width="6" height="3" rx="1" />
    <line x1="9" y1="10" x2="15" y2="10" />
    <line x1="9" y1="14" x2="15" y2="14" />
    <line x1="9" y1="18" x2="15" y2="18" />
  </svg>
);

const SaidGlyph = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    fillOpacity="0.18"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M4 5.5h16v11H10l-5 3.5v-3.5H4Z" />
    <path d="M8.6 10.8 11 13.2l4.4-4.4" fill="none" />
  </svg>
);

const WaypointsGlyph = () => (
  <Stroke>
    <circle cx="12" cy="4.5" r="2.5" />
    <circle cx="4.5" cy="19" r="2.5" />
    <circle cx="19.5" cy="19" r="2.5" />
    <path d="M12 7v3a2 2 0 0 1-2 2H7" />
    <path d="M12 7v3a2 2 0 0 0 2 2h3" />
  </Stroke>
);

const ScoutGlyph = () => (
  <Stroke>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16 20.5 20.5" />
  </Stroke>
);

const BrainGlyph = () => (
  <Stroke>
    <path d="M12 5.5A2.8 2.8 0 0 0 9 8a2.9 2.9 0 0 0-2 5 2.9 2.9 0 0 0 2 5.4 2.6 2.6 0 0 0 3-1.2" />
    <path d="M12 5.5A2.8 2.8 0 0 1 15 8a2.9 2.9 0 0 1 2 5 2.9 2.9 0 0 1-2 5.4 2.6 2.6 0 0 1-3-1.2" />
    <path d="M12 5.5v11.7" />
  </Stroke>
);

const BranchGlyph = () => (
  <Stroke>
    <path d="M6 3v12" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </Stroke>
);

const TemplateGlyph = () => (
  <Stroke>
    <rect x="3" y="3" width="18" height="7" rx="1.5" />
    <rect x="3" y="14" width="9" height="7" rx="1.5" />
    <rect x="16" y="14" width="5" height="7" rx="1.5" />
  </Stroke>
);

const laneUp = (run: Run, at: number, stage: number): Lane => {
  if (run === 'off') {
    return 'none';
  }
  return at === stage ? 'dash' : 'solid';
};

const laneDown = (run: Run): Lane => (run === 'thru' || run === 'step' ? 'solid' : 'none');

const Rail = ({
  up,
  down,
  join,
}: {
  readonly up: Lane;
  readonly down: Lane;
  readonly join: boolean;
}) => (
  <>
    {up !== 'none' && <span className={`ac-lane ac-up ac-${up}${join ? ' ac-cut' : ''}`} />}
    {down !== 'none' && <span className={`ac-lane ac-down ac-${down}`} />}
    {join && <span className="ac-join" />}
  </>
);

const FeedRow = ({ ev, stage }: { readonly ev: Ev; readonly stage: number }) => (
  <div className={`ac-slot${stage >= ev.at ? ' ac-on' : ''}`} style={rowStyle(ev.gap, ev.bh)}>
    <div className="ac-row">
      <div className="ac-gut">
        <span>{ev.time}</span>
      </div>
      <div className="ac-rc">
        <Rail
          up={laneUp(ev.run, ev.at, stage)}
          down={laneDown(ev.run)}
          join={ev.run === 'anchor'}
        />
        <span
          className={`ac-mk ac-${ev.grade} ac-t-${ev.tone}${ev.run === 'step' ? ' ac-onlane' : ''}`}
        >
          {ev.glyph}
        </span>
      </div>
      <div className={`ac-body ac-${ev.grade}${ev.wash === true ? ' ac-wash' : ''}`}>
        {ev.body}
        {ev.action}
      </div>
    </div>
  </div>
);

export const Activity = () => {
  const { ref, inView } = useToggleInView<HTMLDivElement>();
  const [stage, setStage] = useState(() => (prefersReducedMotion() ? AT_LAST : 0));

  useEffect(() => {
    if (!inView || prefersReducedMotion()) {
      return;
    }
    setStage(0);
    const timers = BEATS.map((ms, i) =>
      setTimeout(() => setStage((current) => Math.max(current, i + 1)), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  const answered = stage >= AT_ANSWER;
  const needsYou = stage >= AT_QUESTION && !answered;

  const events: readonly Ev[] = [
    {
      at: 1,
      time: '11:12',
      gap: 0,
      bh: 36,
      grade: 'entry',
      tone: 'info',
      glyph: <BranchGlyph />,
      run: 'off',
      body: (
        <p className="ac-label">
          Branch <span className="ac-val">gb/lin-241-bulk-archive</span> created for{' '}
          <span className="ac-val">api</span>
        </p>
      ),
    },
    {
      at: 2,
      time: '11:14',
      gap: 0,
      bh: 38,
      grade: 'entry',
      tone: 'accent',
      glyph: <WaypointsGlyph />,
      run: 'anchor',
      body: (
        <>
          <span className="ac-runchip">
            <TemplateGlyph />
            workflow
          </span>
          <p className="ac-label">Scout, plan, implement, review</p>
        </>
      ),
    },
    {
      at: 3,
      time: '11:15',
      gap: 0,
      bh: 30,
      grade: 'step',
      tone: 'info',
      glyph: <ScoutGlyph />,
      run: 'step',
      body: (
        <>
          <span className="kb scout">scout</span>
          <p className="ac-label">Read how notifications are stored</p>
          <span className="ac-sec">Claude Haiku 4.5</span>
        </>
      ),
    },
    {
      at: 4,
      time: '11:19',
      gap: 0,
      bh: 30,
      grade: 'step',
      tone: 'info',
      glyph: <BrainGlyph />,
      run: 'step',
      body: (
        <>
          <span className="kb planner">planner</span>
          <p className="ac-label">Drafted 5 steps</p>
          <span className="ac-sec">Claude Opus</span>
        </>
      ),
    },
    {
      at: 5,
      time: '11:20',
      gap: 0,
      bh: 30,
      grade: 'step',
      tone: 'plan',
      glyph: <PlanGlyph />,
      run: 'step',
      body: (
        <>
          <p className="ac-label">
            <span className="ac-sec">Plan:</span> Ship LIN-241, bulk archive for notifications
          </p>
          <span className="ac-sec">5 steps</span>
          <span className="ac-hint">Open plan ↵</span>
        </>
      ),
    },
    {
      at: 6,
      time: '11:21',
      gap: 0,
      bh: 30,
      grade: 'step',
      tone: 'info',
      glyph: <BrainGlyph />,
      run: 'step',
      body: (
        <p className="ac-label">
          Decision recorded by the planner: soft delete only, batches of 500
        </p>
      ),
    },
    {
      at: 7,
      time: '11:28',
      gap: 0,
      bh: 30,
      grade: 'step',
      tone: 'dot',
      glyph: <span className="ac-live" />,
      run: 'step',
      body: (
        <>
          <span className="kb implementer">implementer</span>
          <p className="ac-label">Running on Codex GPT-5.6 Sol</p>
        </>
      ),
    },
    {
      at: 8,
      time: '11:47',
      gap: 0,
      bh: 30,
      grade: 'step',
      tone: 'ok',
      glyph: <CheckGlyph />,
      run: 'step',
      body: (
        <>
          <span className="kb ac-k-tester">tester</span>
          <p className="ac-label ac-ok">Ran 48 tests, 48 passed</p>
          <span className="ac-sec">Codex GPT-5.6 Terra</span>
        </>
      ),
    },
    {
      at: 9,
      time: '11:52',
      gap: 0,
      bh: 36,
      grade: 'entry',
      tone: 'ok',
      glyph: <PrGlyph />,
      run: 'thru',
      body: (
        <p className="ac-label ac-ok">
          Draft PR <span className="ac-val">#1045</span> opened
        </p>
      ),
    },
    {
      at: 10,
      time: '12:05',
      gap: 0,
      bh: 30,
      grade: 'step',
      tone: 'info',
      glyph: <EyeGlyph />,
      run: 'step',
      body: (
        <>
          <span className="kb reviewer">reviewer</span>
          <p className="ac-label">Left 2 comments</p>
          <span className="ac-sec">Cursor Composer</span>
        </>
      ),
    },
    {
      at: 11,
      time: '12:11',
      gap: 0,
      bh: 32,
      grade: 'step',
      tone: 'warn',
      glyph: <AskGlyph />,
      run: 'step',
      wash: !answered,
      action: answered ? undefined : <span className="mockbtn">Answer</span>,
      body: (
        <p className="ac-label">
          Question for you: archive read notifications too, or only unread?
        </p>
      ),
    },
    {
      at: 12,
      time: '12:14',
      gap: 0,
      bh: 30,
      grade: 'step',
      tone: 'ok',
      glyph: <SaidGlyph />,
      run: 'step',
      body: <p className="ac-label ac-ok">You answered: only unread</p>,
    },
    {
      at: 13,
      time: '12:15',
      gap: 0,
      bh: 30,
      grade: 'step',
      tone: 'dot',
      glyph: <span className="ac-live" />,
      run: 'step',
      body: (
        <>
          <span className="kb implementer">implementer</span>
          <p className="ac-label">Resumed on Codex GPT-5.6 Sol</p>
        </>
      ),
    },
    {
      at: 14,
      time: '12:24',
      gap: 0,
      bh: 30,
      grade: 'step',
      tone: 'info',
      glyph: <LampGlyph />,
      run: 'step',
      body: <p className="ac-label">Resolver step added from a suggestion</p>,
    },
    {
      at: 15,
      time: '12:31',
      gap: 0,
      bh: 30,
      grade: 'step',
      tone: 'ok',
      glyph: <CommitGlyph />,
      run: 'step',
      body: (
        <>
          <span className="kb ac-k-resolver">resolver</span>
          <p className="ac-label">Committed 2 fixes</p>
          <span className="ac-sec">Claude Sonnet</span>
        </>
      ),
    },
  ];

  return (
    <section className="block" id="context" aria-labelledby="h2-context">
      <div className="wrap">
        <div className="blockHead">
          <h2 className="rv" id="h2-context">
            Come back and see what ran
          </h2>
          <p className="sub rv" style={delay(80)}>
            Every task keeps its own record: what ran, what was decided, what still needs you. Open
            it after lunch or after a week and you are caught up in a minute.
          </p>
        </div>

        <div className="ac-frame rv" style={delay(160)} ref={ref} aria-hidden="true">
          <div className="ac-head">
            <p className="ac-goal">Ship LIN-241, bulk archive for notifications</p>
            <div className="ovmeta">
              <span className={`pill ${needsYou ? 'stage-you' : 'stage-run'}`}>
                {needsYou ? 'needs you' : 'running'}
              </span>
              <span className="pill ac-issue">
                <BrandMark brand="linear" size={12} />
                LIN-241
              </span>
              <span className="cost">$1.61</span>
            </div>
          </div>

          <div className="ac-feed">
            <p className="ac-eyebrow">Activity</p>
            <div className="ac-stream">
              <div className="ac-slot ac-on" style={rowStyle(0, 26)}>
                <div className="ac-row">
                  <div className="ac-gut">
                    <span className="ac-nowlabel">Now</span>
                  </div>
                  <div className="ac-rc">
                    <span
                      className={`ac-lane ac-down ac-dash${stage >= AT_WORKFLOW ? '' : ' ac-pend'}`}
                    />
                    <span className="ac-nowdot" />
                  </div>
                  <div className="ac-body" />
                </div>
              </div>

              {[...events].reverse().map((ev) => (
                <FeedRow key={ev.at} ev={ev} stage={stage} />
              ))}
            </div>
          </div>
        </div>

        <p className="caption rv" style={delay(200)}>
          Answer the question and the run moves on.
        </p>
        <a className="more rv" style={delay(220)} href={`${SITE.concepts}#the-object-model`}>
          Why the task comes first <span className="arr">→</span>
        </a>
      </div>
    </section>
  );
};
