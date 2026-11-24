import { ADE_GUIDE } from './adeGuide';

export const AdeJobs = () => (
  <section className="adeSection" aria-labelledby="ade-jobs">
    <div className="prose">
      <h2 id="ade-jobs">{ADE_GUIDE.jobs.heading}</h2>
      <p>{ADE_GUIDE.jobs.intro}</p>
      {ADE_GUIDE.jobs.items.map((job) => (
        <div key={job.id} className="adeJob">
          <h3 id={job.id}>{job.title}</h3>
          <p>{job.need}</p>
          <p>{job.how}</p>
          <p className="adeJobLinks">
            {job.links.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </p>
        </div>
      ))}
    </div>
  </section>
);
