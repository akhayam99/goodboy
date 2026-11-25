import { ADE_GUIDE } from './adeGuide';
import { GuideLinks } from './GuideLinks';

export const AdeJobs = () => (
  <section className="guideSection" aria-labelledby="ade-jobs">
    <div className="prose">
      <h2 id="ade-jobs">{ADE_GUIDE.jobs.heading}</h2>
      <p>{ADE_GUIDE.jobs.intro}</p>
      {ADE_GUIDE.jobs.items.map((job) => (
        <div key={job.id} className="guideItem">
          <h3 id={job.id}>{job.title}</h3>
          <p>{job.need}</p>
          <p>{job.how}</p>
          <GuideLinks links={job.links} />
        </div>
      ))}
    </div>
  </section>
);
