import { BrandMark } from '../components/BrandIcons';
import { Avatars, SessionCard } from '../components/SessionCard';
import { delay } from '../components/Reveal';

export const How = () => (
  <section className="block alt" id="how" aria-labelledby="h2-how">
    <div className="wrap">
      <div className="blockHead">
        <h2 className="rv" id="h2-how">
          How it works
        </h2>
        <p className="sub rv" style={delay(80)}>
          The same loop for every task. Something reads each result and decides who works next, so
          the dispatching stops being your job. <b>That is the orchestrator.</b>
        </p>
      </div>
      <div className="hgrid">
        <div className="hcard rv">
          <div className="hn">
            <span className="sn">1</span>
            <h3>You describe what you want</h3>
          </div>
          <div className="hmock">
            <div className="composeBox">
              <span>Add bulk archive to notifications</span>
              <span className="send">Start</span>
            </div>
            <div className="composeHint">workspace: api</div>
          </div>
          <p className="cap">Plain words, like a message to a teammate.</p>
        </div>

        <div className="hcard star rv" style={delay(60)}>
          <div className="hn">
            <span className="sn">2</span>
            <h3>The orchestrator picks the next step</h3>
          </div>
          <div className="hmock">
            <div className="planHead">
              <span className="kb planner">planner</span>
              <span>finished, plan ready</span>
            </div>
            <div className="planRow rv" style={delay(200)}>
              <span className="pn">who</span>
              <span className="kb implementer">implementer</span>
            </div>
            <div className="planRow rv" style={delay(340)}>
              <span className="pn">model</span>
              <span className="mrow">
                <BrandMark brand="anthropic" size={13} />
                claude sonnet
              </span>
            </div>
            <div className="planRow rv" style={delay(480)}>
              <span className="pn">thinking</span>
              <span className="eff">medium</span>
            </div>
          </div>
          <p className="cap">
            It reads what came back and chooses the agent, the model, and how much thinking. Pin a
            step and your pick wins.
          </p>
        </div>

        <div className="hcard rv" style={delay(120)}>
          <div className="hn">
            <span className="sn">3</span>
            <h3>Agents work on their own copy</h3>
          </div>
          <div className="hmock">
            <div className="planHead">
              <Avatars on={['anthropic', 'codex']} />
              <span>two agents, one briefing</span>
            </div>
            <div className="hterm">
              <div className="dim">api/.goodboy/worktrees/bulk-archive</div>
              <div>
                <span className="tp">$</span> pnpm test
              </div>
              <div className="good">✓ 12 passed</div>
            </div>
          </div>
          <p className="cap">
            Each gets a private copy of your files and the same briefing. Nobody starts in the dark
            or re-asks the goal.
          </p>
        </div>

        <div className="hcard rv" style={delay(180)}>
          <div className="hn">
            <span className="sn">4</span>
            <h3>You come back to a result</h3>
          </div>
          <div className="hmock">
            <SessionCard
              goal="Bulk archive for notifications"
              stage="done"
              stageLabel="done"
              tags={['12 files']}
              cost="$1.61"
              on={['anthropic', 'codex']}
              action={
                <span className="mockbtn" style={{ margin: '0 0 0 auto' }}>
                  What changed
                </span>
              }
            />
          </div>
          <p className="cap">
            You see what changed and what it cost. Agents open the pull request; merging waits for
            you.
          </p>
        </div>
      </div>
    </div>
  </section>
);
