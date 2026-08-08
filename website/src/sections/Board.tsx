import { useEffect, useState } from 'react';
import { SessionCard } from '../components/SessionCard';
import { delay, prefersReducedMotion, useInViewOnce } from '../components/Reveal';

type BuildStage = 'running' | 'green' | 'ready';

const BUILD_LABEL: Record<BuildStage, string> = {
  running: 'ci running',
  green: 'checks green',
  ready: 'ready to merge',
};

export const Board = () => {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const [buildStage, setBuildStage] = useState<BuildStage>('running');

  useEffect(() => {
    if (!inView || prefersReducedMotion()) return;
    const t1 = setTimeout(() => setBuildStage('green'), 1600);
    const t2 = setTimeout(() => setBuildStage('ready'), 3100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [inView]);

  return (
    <section className="block alt" id="app" aria-labelledby="h2-app">
      <div className="wrap">
        <div className="blockHead">
          <h2 className="rv" id="h2-app">
            A board, not a chat window
          </h2>
          <p className="sub rv" style={delay(80)}>
            Every task is a card, and every card shows where it stands:{' '}
            <b>needs you, running, in review, building, done</b>. When an agent finishes, the card
            moves by itself.
          </p>
        </div>

        <div className="appframe rv" style={delay(160)} ref={ref}>
          <div className="tbar">
            <span className="tl r" />
            <span className="tl y" />
            <span className="tl g" />
            <span className="tname">goodboy, workspace: api</span>
          </div>
          <div className="board">
            <div className="bcol">
              <div className="bhead">
                <span className="cd you" />
                needs you
                <span className="cnt">1</span>
              </div>
              <SessionCard
                goal="Rotate webhook secrets after the Sentry alert"
                stage="you"
                stageLabel="open question"
                cost="$0.84"
                on={['anthropic']}
              />
            </div>
            <div className="bcol">
              <div className="bhead">
                <span className="cd run" />
                running
                <span className="cnt">2</span>
              </div>
              <SessionCard
                goal="Ship LIN-241, bulk archive for notifications"
                tags={['LIN-241']}
                cost="$1.32"
                on={['anthropic', 'gemini']}
              />
              <SessionCard
                goal="Chase the flaky retry test on ingest"
                tags={['debugger']}
                cost="$0.19"
                on={['codex']}
              />
            </div>
            <div className="bcol">
              <div className="bhead">
                <span className="cd rev" />
                in review
                <span className="cnt">1</span>
              </div>
              <SessionCard
                goal="Refactor auth session storage"
                tags={['PR #482', '2 comments']}
                cost="$2.06"
                on={['anthropic', 'codex', 'cursor']}
              />
            </div>
            <div className="bcol">
              <div className="bhead">
                <span className="cd build" />
                building
                <span className="cnt">1</span>
              </div>
              <SessionCard
                goal="Bump Tauri and re-sign the release build"
                stage="build"
                stageLabel={BUILD_LABEL[buildStage]}
                cost="$0.41"
                on={['gemini']}
                action={
                  buildStage === 'ready' ? (
                    <span className="mockbtn" style={{ margin: '0 0 0 auto' }}>
                      Merge
                    </span>
                  ) : undefined
                }
              />
            </div>
            <div className="bcol">
              <div className="bhead">
                <span className="cd done" />
                done
                <span className="cnt">2</span>
              </div>
              <SessionCard
                goal="Backfill missing indexes on events table"
                stage="done"
                stageLabel="merged"
                cost="$0.77"
                on={['codex']}
              />
              <SessionCard
                goal="Fix the sidebar flash on workspace switch"
                stage="done"
                stageLabel="merged"
                cost="$0.35"
                on={['cursor', 'gemini']}
              />
            </div>
          </div>
        </div>
        <p className="caption rv" style={delay(200)}>
          Nobody has to ask you where things stand. You look once and you know.
        </p>
        <a className="more rv" style={delay(220)} href="#install">
          Start your first task <span className="arr">→</span>
        </a>
      </div>
    </section>
  );
};
