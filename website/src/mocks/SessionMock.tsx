import './SessionMock.css';
import { MockStage } from './MockStage';
import { Plus, Waypoints } from './generated/icons';
import {
  AppButton,
  AppRow,
  AppTopBar,
  GroupLabel,
  NeedsYouChip,
  RunTree,
  StartsInChip,
  WorkNode,
  useIsCoarse,
} from './kit';
import { SESSION_DOORS } from './SESSION_DOORS';
import { SESSION_GROUPS } from './SESSION_GROUPS';
import { SESSION_LIST } from './SESSION_LIST';
import { SESSION_PHONE_ROWS } from './SESSION_PHONE_ROWS';
import { SESSION_ROWS } from './SESSION_ROWS';
import { SESSION_TOOLS } from './SESSION_TOOLS';

export const SessionMock = () => {
  const isCoarse = useIsCoarse();
  return (
    <MockStage
      className="sessionMock"
      label="The session Duplicate credit fix open beside the left column of places and sessions and the column of session tools, with a run of five steps. Steps one to three are done, step four is running, one of its subagents failed and another waits on your answer, and step five is queued."
    >
      <div className="smApp">
        <AppTopBar
          workspace="Harborline"
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
          <nav className="smCol" aria-label="Places and sessions">
            <AppButton className="smNew">
              <Plus size={14} />
              New session
            </AppButton>
            <div className="smDoors">
              {SESSION_DOORS.map(({ label, Icon }) => (
                <span key={label} className="smDoor">
                  <Icon size={14} />
                  {label}
                </span>
              ))}
            </div>
            <GroupLabel label="Sessions" muted className="smColLabel" />
            <div className="smSessions">
              {SESSION_LIST.map((session) => (
                <AppRow
                  key={session.id}
                  isSelected={session.isSelected}
                  height={28}
                  className="smSession"
                >
                  <WorkNode state={session.state} label={session.stateLabel} size="sm" />
                  <span className="smSessionTitle">{session.title}</span>
                </AppRow>
              ))}
            </div>
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
            {SESSION_TOOLS.map((Tool, index) => (
              <span key={index} className="smTool">
                <Tool size={14} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </MockStage>
  );
};
