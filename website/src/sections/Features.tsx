import { useState } from 'react';
import { Block } from '../components/Block';
import { More } from '../components/More';
import { SITE } from '../site';

type Feature = {
  readonly id: string;
  readonly title: string;
  readonly copy: string;
  readonly isNew: boolean;
};

type Group = {
  readonly id: string;
  readonly title: string;
  readonly features: readonly Feature[];
};

type NewItem = {
  readonly title: string;
  readonly copy: string;
};

type Snapshot = {
  readonly version: string;
  readonly summary: string;
  readonly new: readonly NewItem[];
  readonly groups: readonly Group[];
};

const compareVersions = (left: string, right: string) => {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  const index = leftParts.findIndex((part, position) => part !== rightParts[position]);
  return index === -1 ? 0 : rightParts[index] - leftParts[index];
};

const WIDE_QUERY = '(min-width: 561px)';

const SNAPSHOTS: readonly Snapshot[] = Object.values(
  import.meta.glob<Snapshot>('../data/releases/*.json', { eager: true, import: 'default' }),
).sort((left, right) => compareVersions(left.version, right.version));

export const Features = () => {
  const [version, setVersion] = useState(SNAPSHOTS[0]?.version ?? '');
  const [isWide] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  const snapshot = SNAPSHOTS.find((entry) => entry.version === version);
  if (!snapshot) {
    return null;
  }
  const featureCount = snapshot.groups.reduce((total, group) => total + group.features.length, 0);

  return (
    <Block
      id="features"
      headingId="h2-features"
      heading="What it does"
      sub="Every feature, grouped the way a task lives, from set up to clean up."
      isAlt
    >
      <div className="featMap">
        <div className="featBar">
          {SNAPSHOTS.length > 1 ? (
            <label className="featVersion">
              <span className="vh">Version</span>
              <select value={version} onChange={(event) => setVersion(event.target.value)}>
                {SNAPSHOTS.map((entry) => (
                  <option key={entry.version} value={entry.version}>
                    v{entry.version}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="featVersion">v{snapshot.version}</span>
          )}
          <span className="featCount">
            {featureCount} features in {snapshot.groups.length} groups
          </span>
        </div>
        {snapshot.new.length > 0 ? (
          <ul className="featNew" aria-label={`New in v${snapshot.version}`}>
            {snapshot.new.map((item) => (
              <li key={item.title} title={item.copy}>
                <span className="featDot" aria-hidden="true" />
                {item.title}
              </li>
            ))}
          </ul>
        ) : (
          <p className="featSummary">
            <b>In v{snapshot.version}:</b> {snapshot.summary}
          </p>
        )}
        <div className="featGrid">
          {snapshot.groups.map((group) => (
            <details
              key={group.id}
              className="featGroup"
              open={isWide || group.features.some((feature) => feature.isNew)}
            >
              <summary>
                <h3>
                  {group.title} <span>{group.features.length}</span>
                </h3>
              </summary>
              <ul>
                {group.features.map((feature) => (
                  <li
                    key={feature.id}
                    title={feature.copy}
                    className={feature.isNew ? 'isNew' : undefined}
                  >
                    {feature.title}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
        <More href={SITE.features}>Read the full feature guide</More>
      </div>
    </Block>
  );
};
