import './InboxMock.css';
import { MockStage } from './MockStage';
import { INBOX_GROUPS } from './INBOX_GROUPS';
import { INBOX_SOURCES } from './INBOX_SOURCES';
import { Contrast, CirclePlay, Inbox } from './generated/icons';
import { InboxItemRow } from './InboxItemRow';
import { InboxSourceGlyph } from './InboxSourceGlyph';
import { Chip, GroupLabel } from './kit';

type Props = {
  readonly className?: string;
};

const INBOX_VIEWS = [
  { label: 'All', count: 26, icon: Inbox, isSelected: true },
  { label: 'In progress', count: 3, icon: Contrast, isSelected: false },
  { label: 'With a session', count: 5, icon: CirclePlay, isSelected: false },
] as const;

const ITEM_COUNT = INBOX_GROUPS.reduce((total, group) => total + group.items.length, 0);

export const InboxMock = ({ className }: Props) => (
  <MockStage
    label="Tasks with items from GitHub, Linear, Jira, Sentry and Slack in one list. Each row shows its source icon, id, title, state and age, grouped by day. CAS-231 is selected."
    className={className}
  >
    <div className="ibxWin">
      <div className="ibxTop">
        <span className="ibxTopTitle">Tasks</span>
        <span className="ibxPulls">
          <span className="ibxPullsLabel" id="ibx-pulls-label">
            Pulls from
          </span>
          <ul className="ibxPullsList" aria-labelledby="ibx-pulls-label">
            {INBOX_SOURCES.map((source) => (
              <li key={source.id} className="ibxPullsItem">
                <InboxSourceGlyph id={source.id} size={14} />
                <span className="ibxPullsName">{source.name}</span>
              </li>
            ))}
          </ul>
        </span>
      </div>
      <div className="ibxBody">
        <nav className="ibxRail" aria-label="Filter the tasks">
          <GroupLabel label="View" muted className="ibxRailLabel" />
          {INBOX_VIEWS.map((view) => (
            <span key={view.label} className="ibxFacet" data-selected={view.isSelected}>
              <view.icon size={12} />
              <span className="ibxFacetLabel">{view.label}</span>
              <span className="ibxFacetCount">{view.count}</span>
            </span>
          ))}
          <GroupLabel label="Source" muted className="ibxRailLabel" />
          {INBOX_SOURCES.map((source) => (
            <span key={source.id} className="ibxFacet">
              <InboxSourceGlyph id={source.id} size={12} />
              <span className="ibxFacetLabel">{source.name}</span>
              <span className="ibxFacetCount">{source.count}</span>
            </span>
          ))}
        </nav>
        <div className="ibxStrip" aria-hidden>
          {INBOX_VIEWS.map((view) => (
            <Chip
              key={view.label}
              tone={view.isSelected ? 'primary' : 'neutral'}
              size="sm"
              bordered={view.isSelected}
              label={`${view.label} ${view.count}`}
            />
          ))}
        </div>
        <div className="ibxList">
          <div className="ibxListHead">
            <span className="ibxListTitle">All items</span>
            <span className="ibxListCount">{`${ITEM_COUNT} of 26`}</span>
          </div>
          {INBOX_GROUPS.map((group) => (
            <div key={group.label} className="ibxGroup">
              <div className="ibxGroupHead">
                <GroupLabel label={group.label} />
                <span className="ibxGroupCount">{group.items.length}</span>
              </div>
              {group.items.map((item) => (
                <InboxItemRow key={item.id} item={item} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  </MockStage>
);
