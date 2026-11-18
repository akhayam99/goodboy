import './SessionMock.css';
import { MockStage } from './MockStage';
import { Plus, Waypoints } from './generated/icons';
import { AppTopBar, NeedsYouChip, RunTree, StartsInChip, useIsCoarse } from './kit';
import { SESSION_DOORS } from './SESSION_DOORS';
import { SESSION_GROUPS } from './SESSION_GROUPS';
import { SESSION_PHONE_ROWS } from './SESSION_PHONE_ROWS';
import { SESSION_ROWS } from './SESSION_ROWS';
import { SESSION_TOOLS } from './SESSION_TOOLS';

export const SessionMock = () => {
  const isCoarse = useIsCoarse();
  return (
    <MockStage
      className="sessionMock"
      label="The session Duplicate credit fix open between the places rail on the left and the tools rail on the right, with Sessions in the top bar and a run of five steps. Steps one to three are done, step four is running, one of its subagents failed and another waits on your answer, and step five is queued."
    >
      <div className="smApp">
        <AppTopBar
          search="Search or ask"
          end={
            <>
              <NeedsYouChip count={1} className="smNeeds" />
              <span className="smRunning gkTopRunning">
                <span className="smRunningDot" aria-hidden="true" />1 running
              </span>
              <span className="gkTopToday smToday">
                <strong>$2.74</strong>
                today
              </span>
            </>
          }
        />
        <div className="smShell">
          <nav className="smRail" aria-label="Places">
            <span className="smRailItem">
              <span className="smMark" aria-hidden="true">
                H
              </span>
              Harborline
            </span>
            <span className="smRailItem">
              <span className="smRailTile smRailNew">
                <Plus size={16} />
              </span>
              New
            </span>
            {SESSION_DOORS.map(({ label, Icon, isCurrent }) => (
              <span key={label} className="smRailItem" data-current={isCurrent}>
                <span className="smRailTile">
                  <Icon size={16} />
                  {isCurrent ? (
                    <span className="smRailCount" aria-label="1 session needs you">
                      1
                    </span>
                  ) : null}
                </span>
                {label}
              </span>
            ))}
          </nav>
          <div className="smBody">
            <div className="smHead">
              <span className="smIcon" aria-hidden="true">
                <Waypoints size={20} />
              </span>
              <div className="smHeadText">
                <h3 className="smTitle">Duplicate credit fix</h3>
                <p className="smMeta">
                  <span>5 steps</span>
                  <span>10 agents</span>
                  <span>$2.74</span>
                  <span>Limit $12.00</span>
                </p>
              </div>
            </div>
            <div className="smStarts">
              <StartsInChip target="payments-api / hl/fix-duplicate-credit" />
            </div>
            <RunTree
              className="smTree"
              rows={isCoarse ? SESSION_PHONE_ROWS : SESSION_ROWS}
              groups={SESSION_GROUPS}
              hasSpine
              heading="Now"
              label="Steps"
            />
          </div>
          <div className="smTools" aria-hidden="true">
            {SESSION_TOOLS.map(({ label, Icon }) => (
              <span key={label} className="smRailItem">
                <span className="smRailTile">
                  <Icon size={16} />
                </span>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </MockStage>
  );
};
