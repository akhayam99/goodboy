import './Artifacts.css';
import { useEffect, useState } from 'react';
import { delay, prefersReducedMotion, useInViewOnce } from '../components/Reveal';
import { SITE } from '../site';

type Tone = 'plan' | 'question' | 'decision';

type Line = {
  readonly text: string;
  readonly tone?: Tone;
};

type Step = {
  readonly role: string;
  readonly tone: string;
  readonly title: string;
  readonly dot: 'done' | 'run';
  readonly edited?: boolean;
};

const BEATS = [1180, 1570, 6260, 7260];

const AT_PLAN = 1;
const AT_DECISION = 2;
const AT_QUESTION = 3;
const AT_ANSWER = 4;
const AT_LAST = BEATS.length;

const LINES: readonly Line[] = [
  { text: 'Reading packages/api/src/notifications' },
  { text: 'Opened 12 files' },
  { text: 'Read the archive endpoint' },
  { text: 'Listed the callers of markRead' },
  { text: 'Indexed the notifications table' },
  { text: 'Checked the list view query' },
  { text: 'Wrote the brief, 3 files to touch' },
  { text: 'Handing off to the planner' },
  { text: 'Plan: 5 steps, scout to review', tone: 'plan' },
  { text: 'Decision: soft delete only, batches of 500', tone: 'decision' },
  { text: 'Started step 1 of 5' },
  { text: 'Edited archive.ts' },
  { text: 'Added a batch helper' },
  { text: 'Ran 42 tests, 42 passed' },
  { text: 'Edited notifications.service.ts' },
  { text: 'Ran migration 0031' },
  { text: 'Committed to gb/lin-241-bulk-archive' },
  { text: 'Pushed the branch' },
  { text: 'Opened draft PR #1045' },
  { text: 'Checks green on #1045' },
  { text: 'Reviewer left 2 comments' },
  { text: 'Archive read notifications too, or only unread?', tone: 'question' },
  { text: 'Paused, waiting on you' },
  { text: 'Resumed with your answer' },
  { text: 'Edited archive.ts' },
  { text: 'Rebuilt the list query' },
  { text: 'Edited archive.test.ts' },
  { text: 'Ran 48 tests, 48 passed' },
  { text: 'Checked the list view' },
  { text: 'Formatted 6 files' },
  { text: 'Reading packages/api/src/jobs' },
  { text: 'Edited jobs/purge.ts' },
  { text: 'Ran 48 tests, 48 passed' },
  { text: 'Committed 2 fixes' },
  { text: 'Pushed the branch' },
  { text: 'Replied to both comments on #1045' },
  { text: 'Waiting on checks' },
  { text: 'Checks green on #1045' },
];

const STEPS: readonly Step[] = [
  { role: 'scout', tone: 'scout', title: 'Read how notifications are stored', dot: 'done' },
  { role: 'planner', tone: 'planner', title: 'Draft the archive steps', dot: 'done' },
  {
    role: 'implementer',
    tone: 'implementer',
    title: 'Archive endpoint, batches of 500',
    dot: 'done',
    edited: true,
  },
  { role: 'tester', tone: 'ar-k-tester', title: 'Run the suite, fix the reds', dot: 'done' },
  { role: 'reviewer', tone: 'reviewer', title: 'Read the diff before the PR', dot: 'run' },
];

const playState = (reduced: boolean, seen: boolean) => {
  if (reduced) {
    return 'still';
  }
  return seen ? 'run' : 'idle';
};

export const Artifacts = () => {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const [stage, setStage] = useState(() => (prefersReducedMotion() ? AT_LAST : 0));

  useEffect(() => {
    if (!inView || prefersReducedMotion()) {
      return;
    }
    const timers = BEATS.map((ms, i) =>
      setTimeout(() => setStage((current) => Math.max(current, i + 1)), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  const play = playState(prefersReducedMotion(), inView);
  const answered = stage >= AT_ANSWER;

  return (
    <section className="block" id="artifacts" aria-labelledby="h2-artifacts">
      <div className="wrap">
        <div className="blockHead">
          <h2 className="rv" id="h2-artifacts">
            The plan does not scroll away
          </h2>
          <p className="sub rv" style={delay(80)}>
            A chat buries the plan under the next hundred lines. Here the plan, the open question and
            the decision are <b>objects that stay where you left them</b>, and you can edit, answer
            or reread them any time.
          </p>
        </div>

        <div className="appframe rv" style={delay(160)} ref={ref} aria-hidden="true">
          <div className="tbar">
            <span className="tl r" />
            <span className="tl y" />
            <span className="tl g" />
            <span className="tname">goodboy, acme / Ship LIN-241</span>
          </div>

          <div className="ar-panes">
            <div className="ar-pane">
              <p className="ar-eyebrow">Chat</p>
              <div className="ar-chat" data-play={play}>
                <div className="ar-track">
                  {LINES.map((line, i) => (
                    <p
                      className={`ar-line${line.tone === undefined ? '' : ` ar-${line.tone}`}`}
                      key={`${line.text}-${i}`}
                    >
                      {line.text}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="ar-pane ar-kept">
              <p className="ar-eyebrow">Kept</p>
              <div className="ar-cards">
                <div className={`ar-card ar-accent${stage >= AT_PLAN ? ' ar-in' : ''}`}>
                  <p className="ar-ckind">Plan</p>
                  <p className="ar-ctitle">Ship LIN-241, bulk archive for notifications</p>
                  <div className="ar-steps">
                    {STEPS.map((step) => (
                      <div className="ar-step" key={step.title}>
                        <span className={`kb ${step.tone}`}>{step.role}</span>
                        <span className="ar-stitle">{step.title}</span>
                        {step.edited === true && <span className="ar-edit">edited by you</span>}
                        <span className={`ar-dot ar-d-${step.dot}`} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className={`ar-card ar-info${stage >= AT_DECISION ? ' ar-in' : ''}`}>
                  <p className="ar-ckind">Decision</p>
                  <p className="ar-ctitle">Soft delete only. Batches of 500.</p>
                  <span className="ar-cctx">Recorded by the planner at 11:21</span>
                </div>

                <div className={`ar-card ar-warn${stage >= AT_QUESTION ? ' ar-in' : ''}`}>
                  <p className="ar-ckind">Open question</p>
                  <p className="ar-ctitle">Archive read notifications too, or only unread?</p>
                  <span className="ar-crow">
                    <span className="ar-cctx">Asked by the implementer at 12:11</span>
                    <span className="ar-swap">
                      <span className={`ar-sw${answered ? '' : ' ar-on'}`}>
                        <span className="mockbtn">Answer</span>
                      </span>
                      <span className={`ar-sw${answered ? ' ar-on' : ''}`}>
                        <span className="ar-ans">✓ Only unread</span>
                      </span>
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="caption rv" style={delay(200)}>
          The chat keeps moving. These three do not.
        </p>
        <a className="more rv" style={delay(220)} href={`${SITE.concepts}#plans`}>
          How plans work <span className="arr">→</span>
        </a>
      </div>
    </section>
  );
};
