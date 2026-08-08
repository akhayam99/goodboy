import { delay } from '../components/Reveal';

export const BuiltFor = () => (
  <section className="block alt" id="builtfor" aria-labelledby="h2-builtfor">
    <div className="wrap">
      <div className="blockHead">
        <h2 className="rv" id="h2-builtfor">
          Built around software work
        </h2>
        <p className="sub rv" style={delay(80)}>
          The best parts expect a code repository: <b>the diff, the pull request, the review</b>.
          Point it at a plain folder and everything else works the same.
        </p>
      </div>
      <div className="wsgrid">
        <div className="slot rv">
          <h5>Single project</h5>
          <p>One repository, with branches, diffs, and pull requests in play.</p>
        </div>
        <div className="slot rv" style={delay(60)}>
          <h5>Multi project</h5>
          <p>A few repositories in one workspace, one board across them.</p>
        </div>
        <div className="slot rv" style={delay(120)}>
          <h5>Standalone</h5>
          <p>
            A plain folder, no git: a thesis, a contract pile, a blog. The loop still runs, minus
            the git parts.
          </p>
        </div>
      </div>
    </div>
  </section>
);
