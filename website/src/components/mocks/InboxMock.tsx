import './InboxMock.css';
import { MockStage } from './MockStage';
import { AppBrandIcon, Contrast, Inbox, CirclePlay, type AppBrandId } from './icons';
import { AppRow, Chip, GroupLabel, RecordState, type InboxState } from './kit';

type Props = {
  readonly className?: string;
};

type Source = {
  readonly id: AppBrandId;
  readonly name: string;
  readonly count: number;
};

type Item = {
  readonly id: string;
  readonly source: AppBrandId;
  readonly title: string;
  readonly context: string;
  readonly category: InboxState;
  readonly state: string;
  readonly age: string;
  readonly hasSession: boolean;
  readonly isSelected: boolean;
};

type Group = {
  readonly label: string;
  readonly items: readonly Item[];
};

const SOURCES: readonly Source[] = [
  { id: 'github', name: 'GitHub', count: 9 },
  { id: 'linear', name: 'Linear', count: 8 },
  { id: 'jira', name: 'Jira', count: 3 },
  { id: 'sentry', name: 'Sentry', count: 4 },
  { id: 'slack', name: 'Slack', count: 2 },
];

const VIEWS = [
  { label: 'All', count: 26, icon: Inbox, isSelected: true },
  { label: 'In progress', count: 3, icon: Contrast, isSelected: false },
  { label: 'With a session', count: 5, icon: CirclePlay, isSelected: false },
] as const;

const GROUPS: readonly Group[] = [
  {
    label: 'Today',
    items: [
      {
        id: 'CORE-API-7',
        source: 'sentry',
        title: 'DuplicateChargeError on order capture',
        context: 'payments-api',
        category: 'alert',
        state: 'Unresolved',
        age: '8m ago',
        hasSession: false,
        isSelected: false,
      },
      {
        id: 'CAS-231',
        source: 'linear',
        title: 'Refunds on split payments keep the second charge',
        context: 'CAS Payments',
        category: 'active',
        state: 'In progress',
        age: '25m ago',
        hasSession: true,
        isSelected: true,
      },
      {
        id: '#187',
        source: 'github',
        title: 'Admin sessions table loads every row at once',
        context: 'payments-api',
        category: 'open',
        state: 'Open',
        age: '50m ago',
        hasSession: false,
        isSelected: false,
      },
      {
        id: '#payments',
        source: 'slack',
        title: 'Webhook retries pile up since the deploy?',
        context: '3 replies',
        category: 'open',
        state: 'Open',
        age: '2h ago',
        hasSession: false,
        isSelected: false,
      },
      {
        id: 'FIN-91',
        source: 'jira',
        title: 'Reconcile the settlement export before close',
        context: 'FIN Finance',
        category: 'active',
        state: 'In review',
        age: '3h ago',
        hasSession: true,
        isSelected: false,
      },
    ],
  },
  {
    label: 'Yesterday',
    items: [
      {
        id: '#184',
        source: 'github',
        title: 'Add an idempotency key to the refund call',
        context: 'payments-api',
        category: 'done',
        state: 'Merged',
        age: '1d ago',
        hasSession: false,
        isSelected: false,
      },
      {
        id: 'CAS-228',
        source: 'linear',
        title: 'Backfill refund ledger entries',
        context: 'CAS Payments',
        category: 'done',
        state: 'Done',
        age: '1d ago',
        hasSession: true,
        isSelected: false,
      },
    ],
  },
];

const ITEM_COUNT = GROUPS.reduce((total, group) => total + group.items.length, 0);

const SourceGlyph = ({ id, size }: { readonly id: AppBrandId; readonly size: number }) => (
  <span className="ibxBrand" style={{ color: `var(--g-provider-${id})` }}>
    <AppBrandIcon brand={id} size={size} />
  </span>
);

const ItemRow = ({ item }: { readonly item: Item }) => (
  <AppRow isSelected={item.isSelected} className="ibxRow" innerClassName="ibxRowInner">
    <span className="ibxDot" data-on={item.hasSession ? '' : undefined} aria-hidden />
    <span className="ibxGlyph" aria-hidden>
      <SourceGlyph id={item.source} size={14} />
    </span>
    <span className="ibxId">{item.id}</span>
    <span className="ibxTitle" data-done={item.category === 'done' ? '' : undefined}>
      {item.title}
    </span>
    <span className="ibxContext">{item.context}</span>
    <RecordState category={item.category} label={item.state} className="ibxState" />
    <span className="ibxAge">{item.age}</span>
  </AppRow>
);

export const InboxMock = ({ className }: Props) => (
  <MockStage
    label="Inbox with items from GitHub, Linear, Jira, Sentry and Slack in one list. Each row shows its source icon, id, title, state and age, grouped by day. CAS-231 is selected."
    className={className}
  >
    <div className="ibxWin">
      <div className="ibxTop">
        <span className="ibxTopTitle">Inbox</span>
        <span className="ibxPulls">
          <span className="ibxPullsLabel" id="ibx-pulls-label">
            Pulls from
          </span>
          <ul className="ibxPullsList" aria-labelledby="ibx-pulls-label">
            {SOURCES.map((source) => (
              <li key={source.id} className="ibxPullsItem">
                <SourceGlyph id={source.id} size={14} />
                <span className="ibxPullsName">{source.name}</span>
              </li>
            ))}
          </ul>
        </span>
      </div>
      <div className="ibxBody">
        <nav className="ibxRail" aria-label="Filter the inbox">
          <GroupLabel label="View" muted className="ibxRailLabel" />
          {VIEWS.map((view) => (
            <span key={view.label} className="ibxFacet" data-selected={view.isSelected}>
              <view.icon size={12} />
              <span className="ibxFacetLabel">{view.label}</span>
              <span className="ibxFacetCount">{view.count}</span>
            </span>
          ))}
          <GroupLabel label="Source" muted className="ibxRailLabel" />
          {SOURCES.map((source) => (
            <span key={source.id} className="ibxFacet">
              <SourceGlyph id={source.id} size={12} />
              <span className="ibxFacetLabel">{source.name}</span>
              <span className="ibxFacetCount">{source.count}</span>
            </span>
          ))}
        </nav>
        <div className="ibxStrip" aria-hidden>
          {VIEWS.map((view) => (
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
          {GROUPS.map((group) => (
            <div key={group.label} className="ibxGroup">
              <div className="ibxGroupHead">
                <GroupLabel label={group.label} />
                <span className="ibxGroupCount">{group.items.length}</span>
              </div>
              {group.items.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  </MockStage>
);
