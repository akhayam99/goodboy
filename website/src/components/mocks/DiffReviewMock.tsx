import './DiffReviewMock.css';
import type { ReactNode } from 'react';
import { ChevronRight } from './icons';
import { Chip, StateBadge } from './kit';
import { MockStage } from './MockStage';
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

const TABS = ['Comments', 'Files', 'Commits', 'Checks'] as const;

const BLOCKS: readonly ('add' | 'del')[] = ['add', 'add', 'add', 'del', 'del'];

export const DiffReviewMock = ({ className }: Props) => (
  <MockStage
    label="The Branch page for a payments-api branch, with the tabs Comments, Files, Commits and Checks. The Files tab shows a line changed to dedupe on the event id, with an open note under it."
    className={className}
  >
    <MockWindow className="dfrWin">
      <div className="dfrTabs" role="presentation">
        {TABS.map((tab) => (
          <span key={tab} className="dfrTab" data-active={tab === 'Files' ? 'true' : undefined}>
            {tab}
          </span>
        ))}
      </div>
      <div className="dfrFile">
        <ChevronRight size={14} className="dfrOpen" />
        <StateBadge tone="warning" className="dfrStatus">
          M
        </StateBadge>
        <span className="dfrPath">
          <span className="dfrDir">src/webhooks/</span>
          <span className="dfrName">applyWebhook.ts</span>
        </span>
        <span className="dfrStat">
          <span className="dfrAdd">+20</span> <span className="dfrDel">{'−'}10</span>
        </span>
        <span aria-hidden className="dfrBlocks">
          {BLOCKS.map((kind, index) => (
            <i key={index} data-kind={kind} />
          ))}
        </span>
      </div>
      <div className="dfrRows">
        {LINES.map((line) => (
          <div key={`${line.oldLine}-${line.newLine}`} className="dfrLine" data-kind={line.kind}>
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
              <span>Fix</span>
              <span>Close note</span>
              <span>Delete</span>
            </span>
          </div>
          <p className="dfrThreadText">
            Log the duplicate at info with the event id, so on-call can count redeliveries. Kenji W.
            asked for it on #318.
          </p>
        </div>
      </div>
    </MockWindow>
  </MockStage>
);
