import './Workspace.css';
import { useEffect, useState } from 'react';
import { delay, prefersReducedMotion, useInViewOnce } from '../components/Reveal';
import { SITE } from '../site';

type Project = {
  readonly name: string;
  readonly pr: string | null;
};

const PROJECTS: readonly Project[] = [
  { name: 'api', pr: 'PR #1045' },
  { name: 'web', pr: 'PR #3050' },
  { name: 'mobile', pr: null },
  { name: 'billing', pr: null },
  { name: 'auth', pr: null },
  { name: 'search', pr: null },
  { name: 'docs', pr: null },
  { name: 'infra', pr: null },
];

const LAST_STEP = 6;

const STEP_AT: readonly number[] = [400, 1400, 2100, 3000, 4300, 5700];

const CheckGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
    <path d="M5 13l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const cx = (...parts: readonly (string | false)[]) => parts.filter(Boolean).join(' ');

export const Workspace = () => {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const [step, setStep] = useState(() => (prefersReducedMotion() ? LAST_STEP : 0));

  useEffect(() => {
    if (!inView || prefersReducedMotion()) {
      return;
    }
    const timers = STEP_AT.map((at, i) =>
      setTimeout(() => setStep((current) => Math.max(current, i + 1)), at),
    );
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  const touchedProjects = PROJECTS.filter((project) => project.pr != null);
  const restProjects = PROJECTS.filter((project) => project.pr == null);

  return (
    <section className="block alt" id="workspace" aria-labelledby="h2-workspace">
      <div className="wrap">
        <div className="blockHead">
          <h2 className="rv" id="h2-workspace">
            Eight repos, one goal
          </h2>
          <p className="sub rv" style={delay(80)}>
            Put every repo you work on in one workspace. Describe the goal and{' '}
            <b>Goodboy figures out which projects it touches</b>, opens a branch in each, and comes
            back with a pull request per repo.
          </p>
        </div>

        <div className="ws-frame rv" style={delay(160)} ref={ref} aria-hidden="true">
          <div className="ws-body">
            <div className="ws-head">
              <span className="ws-hl">
                <span className="ws-eyebrow">Projects</span>
                <span className="ws-total">8</span>
              </span>
              <span className={cx('ws-touched', step >= 3 && 'ws-in')}>2 of 8 touched</span>
            </div>
            <div className="hairline" />

            <div className={cx('ws-goal', step >= 1 && 'ws-in')}>
              <span className="ws-goal-label">Goal</span>
              <p className="ws-goal-text">
                Ship LIN-241, bulk archive for notifications
              </p>
            </div>

            <div className="ws-grid">
              <div className="ws-touched-group">
                {touchedProjects.map((project, i) => {
                  const lit = step >= i + 2;

                  return (
                    <div className="ws-tile" key={project.name}>
                      <span className={cx('ws-chip', lit && 'ws-lit')}>{project.name}</span>
                      <div className="ws-stack" style={delay(i * 240)}>
                        <span className={cx('ws-row', 'ws-branch', step >= 5 && 'ws-in')}>
                          <span className="ws-rk">branch</span>
                          <span className="ws-rv">gb/lin-241-bulk-archive</span>
                        </span>
                        <span className={cx('ws-row', 'ws-pr', step >= 6 && 'ws-in')}>
                          <CheckGlyph />
                          {project.pr}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="ws-rest-group">
                {restProjects.map((project) => (
                  <div className="ws-tile" key={project.name}>
                    <span className={cx('ws-chip', step >= 3 && 'ws-off')}>{project.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="caption rv" style={delay(200)}>
          The other six stay exactly as they were.
        </p>
        <a className="more rv" style={delay(220)} href={SITE.concepts}>
          How workspaces work <span className="arr">→</span>
        </a>
      </div>
    </section>
  );
};
