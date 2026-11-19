import './DiffReviewMock.css';
import type { ReactNode } from 'react';
import { ChevronRight } from './generated/icons';
import { Chip, StateBadge } from './kit';
import { MockStage } from './MockStage';
import { DIFF_REVIEW_FILES } from './diffReviewFiles';
import { DiffReviewHead } from './DiffReviewHead';
import { DiffReviewScope } from './DiffReviewScope';
import { DiffReviewTabs } from './DiffReviewTabs';
import { DiffReviewTree } from './DiffReviewTree';
import { DiffReviewTreeHead } from './DiffReviewTreeHead';
import { MockWindow } from './MockWindow';

type Props = {
  readonly className?: string;
};

type LineKind = 'context' | 'del' | 'add';

type Line = {
  readonly kind: LineKind;
  readonly oldLine: number | null;
  readonly newLine: number | null;
  readonly code: ReactNode;
};

const kw = (text: string) => <span className="dfrKw">{text}</span>;
const fn = (text: string) => <span className="dfrFn">{text}</span>;
const op = (text: string) => <span className="dfrOp">{text}</span>;
const mark = (kind: 'del' | 'add', text: string) => (
  <span className="dfrWord" data-kind={kind}>
    <span className="dfrProp">{text}</span>
  </span>
);

const LINES: readonly Line[] = [
  {
    kind: 'context',
    oldLine: 39,
    newLine: 39,
    code: (
      <>
        {kw('export')} {kw('const')} {fn('applyWebhook')} {op('=')} {kw('async')} (event) {op('=>')}{' '}
        {'{'}
      </>
    ),
  },
  {
    kind: 'del',
    oldLine: 40,
    newLine: null,
    code: (
      <>
        {'  '}
        {kw('if')} ({fn('seen')}({mark('del', 'payload.hash')})) {kw('return')};
      </>
    ),
  },
  {
    kind: 'add',
    oldLine: null,
    newLine: 40,
    code: (
      <>
        {'  '}
        {kw('if')} ({fn('seen')}({mark('add', 'event.id')})) {kw('return')};
      </>
    ),
  },
  {
    kind: 'context',
    oldLine: 41,
    newLine: 41,
    code: (
      <>
        {'  '}
        {kw('await')} {fn('postCredit')}(tx, event);
      </>
    ),
  },
  {
    kind: 'context',
    oldLine: 42,
    newLine: 42,
    code: <>{'};'}</>,
  },
];

const SIGN: Record<LineKind, string> = { context: ' ', del: '-', add: '+' };

const SHOWN_FILE = DIFF_REVIEW_FILES[0];

export const DiffReviewMock = ({ className }: Props) => (
  <MockStage
    label="The Branch page of pull request 318, hl/fix-duplicate-credit into main, on its Changes tab, with the tabs Conversation, Changes, Commits, Checks, Runs and Comments under the title. A tree of the two changed files sits on the left with the lines added and removed, the page says payments-api, compared with main and one of two files viewed, and a line changed to dedupe on the event id carries an open note under it."
    className={className}
  >
    <MockWindow className="dfrWin">
      <div className="dfrBody">
        <div className="dfrSide">
          <DiffReviewTreeHead />
          <DiffReviewTree />
        </div>
        <div className="dfrMain">
          <DiffReviewHead />
          <DiffReviewTabs />
          <DiffReviewScope />
          <div className="dfrFile">
            <ChevronRight size={14} className="dfrOpen" />
            <StateBadge tone="warning" className="dfrStatus">
              M
            </StateBadge>
            <span className="dfrPath">
              <span className="dfrDir">src/webhooks/</span>
              <span className="dfrName">{SHOWN_FILE?.name}</span>
            </span>
            <span className="dfrStat">
              <span className="dfrAdd">+{SHOWN_FILE?.added}</span>{' '}
              <span className="dfrDel">
                {'−'}
                {SHOWN_FILE?.removed}
              </span>
            </span>
            <span className="dfrFileAction">Viewed</span>
            <span className="dfrFileAction">Comment</span>
          </div>
          <div className="dfrRows">
            {LINES.map((line) => (
              <div
                key={`${line.oldLine}-${line.newLine}`}
                className="dfrLine"
                data-kind={line.kind}
              >
                <span className="dfrNum">{line.oldLine}</span>
                <span className="dfrNum">{line.newLine}</span>
                <span className="dfrSign">{SIGN[line.kind]}</span>
                <span className="dfrCode">{line.code}</span>
              </div>
            ))}
          </div>
          <div className="dfrThreadRow">
            <div className="dfrThread">
              <div className="dfrThreadHead">
                <span aria-hidden className="dfrAvatar">
                  Y
                </span>
                <span className="dfrAuthor">You</span>
                <span>{'·'} 9m ago</span>
                <Chip tone="primary" size="3xs" bordered={false} label="Open note" />
                <span className="dfrThreadActions">
                  <span>Close note</span>
                  <span>Delete</span>
                </span>
              </div>
              <p className="dfrThreadText">
                Log the duplicate at info with the event id, so on-call can count redeliveries.
                Kenji W. asked for it on #318.
              </p>
            </div>
          </div>
        </div>
      </div>
    </MockWindow>
  </MockStage>
);
