import './HandoffMock.css';
import {
  AppBrandIcon,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  CodeXml,
  Database,
  Plus,
  Waypoints,
} from './generated/icons';
import { GroupLabel, KindChip, WorkNode } from './kit';
import { HANDOFF_CAPTIONS } from './HANDOFF_CAPTIONS';
import { HANDOFF_HOLDS } from './HANDOFF_HOLDS';
import { HandoffDecisionRow } from './HandoffDecisionRow';
import { useStepLoop } from './useStepLoop';

export const HandoffMock = () => {
  const { ref, step } = useStepLoop<HTMLDivElement>({ holds: HANDOFF_HOLDS });
  const isAdded = step >= 1;
  const isReplaced = step >= 2;
  const isStarted = step >= 3;
  const isRead = step >= 4;

  return (
    <div
      ref={ref}
      className="handoff"
      data-step={step}
      role="group"
      aria-label="The planner finishes and adds a decision to the task. It replaces an older decision. The implementer then starts and its brief shows the decision it read."
    >
      <div className="hmApp">
        <div className="hmLeft" data-idle={isStarted ? undefined : ''}>
          <div className="hmCrumb">
            <span>Agents</span>
            <ChevronRight size={14} />
            <KindChip kind="implementer" />
            <span className="hmCrumbId">3.1</span>
            <WorkNode
              state={isStarted ? 'running' : 'queued'}
              label={isStarted ? 'Running' : 'Queued'}
              size="sm"
            />
          </div>
          <div className="hmMsg">
            <div className="hmSent">
              <ChevronRight size={14} />
              <Waypoints size={14} />
              <GroupLabel label="Sent by" />
              <span className="hmSentValue">Workflow step 3 of 5</span>
              <span className="hmSpacer" />
              <span className="hmTime">07:55</span>
            </div>
            <p className="hmAsk">
              Make a redelivered webhook credit the account once, keyed on the processor event id.
            </p>
            <p className="hmWhy" data-hot={isRead ? '' : undefined}>
              <span className="hmWhyPre">Why: </span>D3 moved the dedupe inside the transaction, so
              the handler check from D1 is gone.
              <span className="hmWhyTag">
                <ArrowRight size={10} />
                Decision 7
              </span>
            </p>
          </div>
          <p className="hmReply">
            Moving the event id insert into the credit transaction. A unique violation on{' '}
            <span className="hmCode">(account_id, event_id)</span> now means the event already
            landed, so the handler answers 200 and posts nothing.
          </p>
          <div className="hmOps">
            <ChevronRight size={14} />
            <WorkNode state="done" label="Done" size="sm" />
            <GroupLabel label="Operations" className="hmOpsLabel" />
            <span className="hmBadge">3</span>
            <span className="hmMuted">3 edit</span>
          </div>
          <div className="hmComposer">
            <div className="hmPlaceholder">What should Implementer build?</div>
            <div className="hmComposerBar">
              <span className="hmIconButton">
                <Plus size={14} />
              </span>
              <span className="hmAskFirst">
                Ask first
                <ChevronDown size={12} />
              </span>
              <span className="hmSpacer" />
              <span className="hmRoute">
                <span className="hmRouteBrand">
                  <AppBrandIcon brand="codex" size={12} />
                </span>
                <span className="hmRouteLabel">GPT-5.6 Sol {'·'} Medium</span>
                <ChevronDown size={12} />
              </span>
              <span className="hmSend">
                <ArrowRight size={14} style={{ transform: 'rotate(-90deg)' }} />
              </span>
            </div>
          </div>
        </div>
        <div className="hmRight">
          <div className="hmDrawerHead">
            <Database size={16} />
            <span className="hmDrawerTitle">Context</span>
          </div>
          <div className="hmStatus">
            <span className="hmStatusDot" aria-hidden="true" />
            {isAdded ? 'Updated just now' : 'Updated 1h ago'}
          </div>
          <div className="hmActive">
            <div className="hmSection">
              <span className="hmSectionTitle">Decisions</span>
              <span className="hmBadge">{isAdded ? 4 : 3}</span>
              <span className="hmSpacer" />
              <span className="hmSectionAction">
                <CodeXml size={12} />
                Edit source
              </span>
            </div>
            <HandoffDecisionRow number={4} source="You · 1d">
              Backfill runs read only for its first pass
            </HandoffDecisionRow>
            <HandoffDecisionRow
              number={5}
              source="Plan · turn 9 · 2h"
              isHot={step === 2}
              isOld={isReplaced}
              label={<span className="hmLabel hmReplaced">Replaced by 7</span>}
            >
              Show the banner after the first failed retry
            </HandoffDecisionRow>
            <HandoffDecisionRow
              number={6}
              source="Design the idempotency key and backfill plan · turn 11 · 1h"
            >
              Keep the retry state store on payments-api, so notify-relay stays a read only view
            </HandoffDecisionRow>
            <div className="hmNewSlot" data-shown={isAdded ? '' : undefined}>
              <HandoffDecisionRow
                number={7}
                source="Agree where the dedupe belongs · turn 14 · just now"
                isHot={step === 1 || step === 4}
                label={
                  <>
                    <span
                      className="hmLabel hmAdded"
                      data-on={step >= 1 && !isRead ? '' : undefined}
                    >
                      New
                    </span>
                    <span className="hmLabel hmReadBy" data-on={isRead ? '' : undefined}>
                      Read by Implementer
                    </span>
                  </>
                }
              >
                Show the stuck-delivery banner after the third failed retry, not the first
              </HandoffDecisionRow>
            </div>
          </div>
        </div>
      </div>
      <div className="hmCaption">
        <span className="hmSteps" aria-hidden="true">
          {[1, 2, 3, 4].map((dot) => (
            <span key={dot} className="hmStepDot" data-on={step >= dot ? '' : undefined} />
          ))}
        </span>
        <p className="hmCaptionText">{HANDOFF_CAPTIONS[step]}</p>
      </div>
    </div>
  );
};
