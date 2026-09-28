import './Features.css';
import { useState } from 'react';
import { SNAPSHOTS } from '../data/releases';
import { SITE } from '../site';

const WIDE_QUERY = '(min-width: 561px)';

export const Features = () => {
  const [version, setVersion] = useState(SNAPSHOTS[0]?.version ?? '');
  const [isWide] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  const snapshot = SNAPSHOTS.find((entry) => entry.version === version);
  if (snapshot === undefined) {
    return null;
  }
  const featureCount = snapshot.groups.reduce((total, group) => total + group.features.length, 0);

  return (
    <section className="features" id="features" aria-label="Features by group">
      <div className="featBar">
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
        <span className="featCount">
          {featureCount} features in {snapshot.groups.length} groups
        </span>
      </div>
      {snapshot.new.length > 0 ? (
        <p className="featSummary">
          <b>New in v{snapshot.version}:</b> {snapshot.new.map((item) => item.title).join(', ')}.
        </p>
      ) : (
        <p className="featSummary">
          <b>In v{snapshot.version}:</b> {snapshot.summary}
        </p>
      )}
      <div className="featGrid">
        {snapshot.groups.map((group) => (
          <details
            key={group.id}
            id={group.id}
            className="featGroup"
            open={isWide || group.features.some((feature) => feature.isNew)}
          >
            <summary>
              <h2>
                {group.title} <span>{group.features.length}</span>
              </h2>
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
      <a className="textLink" href={SITE.featureGuide}>
        Read the full feature guide <span aria-hidden="true">→</span>
      </a>
    </section>
  );
};
