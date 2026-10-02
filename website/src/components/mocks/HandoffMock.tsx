import './HandoffMock.css';
import type { ReactNode } from 'react';
import {
  AppBrandIcon,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Database,
  Plus,
  Waypoints,
} from './icons';
import { GroupLabel, KindChip, WorkNode } from './kit';
import { useStepLoop } from './useStepLoop';

const HOLDS: ReadonlyArray<number> = [1600, 3200, 3200, 2800, 4800];

const CAPTIONS: ReadonlyArray<string> = [
  'Decisions live in the task, not in a chat.',
  'The planner finishes and adds a new decision.',
  'It replaces an old one, which stays marked Replaced.',
  'The next agent starts fresh, with no chat to read.',
  'Its brief shows the decision it read. Nothing to repeat.',
];

const DoneNode = () => <WorkNode state="done" label="Done" size="sm" />;

type RowProps = {
  readonly number: number;
  readonly source: string;
  readonly children: ReactNode;
  readonly isHot?: boolean;
  readonly isOld?: boolean;
  readonly label?: ReactNode;
};

const DecisionRow = ({
  number,
  source,
  children,
  isHot = false,
  isOld = false,
  label,
}: RowProps) => (
  <div className="hmDec" data-hot={isHot ? '' : undefined} data-old={isOld ? '' : undefined}>
    <span className="hmNum">{number}</span>
    <div className="hmDecBody">
      <div className="hmDecText">
        {children}
        {label}
      </div>
      <div className="hmDecSource">{source}</div>
    </div>
  </div>
);

export const HandoffMock = () => {
  const { ref, step } = useStepLoop<HTMLDivElement>({ holds: HOLDS });
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
            <DoneNode />
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
            <span className="hmSpacer" />
            <span className="hmUpdated">{isAdded ? 'Updated just now' : 'Updated 1h ago'}</span>
          </div>
          <div className="hmTabs">
            <span className="hmTab">Goal</span>
            <span className="hmTab" data-active="">
              Decisions <b>{isAdded ? 4 : 3}</b>
            </span>
            <span className="hmTab">Summary</span>
          </div>
          <div className="hmActive">
            <GroupLabel
              label={
                <>
                  Active <span className="hmBadge">{isAdded ? 4 : 3}</span>
                </>
              }
            />
            <DecisionRow number={4} source="You · 1d">
              Backfill runs read only for its first pass
            </DecisionRow>
            <DecisionRow
              number={5}
              source="Plan · turn 9 · 2h"
              isHot={step === 2}
              isOld={isReplaced}
              label={<span className="hmLabel hmReplaced">Replaced by 7</span>}
            >
              Show the banner after the first failed retry
            </DecisionRow>
            <DecisionRow
              number={6}
              source="Design the idempotency key and backfill plan · turn 11 · 1h"
            >
              Keep the retry state store on payments-api, so notify-relay stays a read only view
            </DecisionRow>
            <div className="hmNewSlot" data-shown={isAdded ? '' : undefined}>
              <DecisionRow
                number={7}
                source="Agree where the dedupe belongs · turn 14 · just now"
                isHot={step === 1 || step === 4}
                label={
                  <>
                    <span
                      className="hmLabel hmAdded"
                      data-on={step >= 1 && !isRead ? '' : undefined}
                    >
                      Added by Planner
                    </span>
                    <span className="hmLabel hmReadBy" data-on={isRead ? '' : undefined}>
                      Read by Implementer
                    </span>
                  </>
                }
              >
                Show the stuck-delivery banner after the third failed retry, not the first
              </DecisionRow>
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
        <p className="hmCaptionText">{CAPTIONS[step]}</p>
      </div>
    </div>
  );
};
