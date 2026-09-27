import { Block } from '../components/Block';
import { More } from '../components/More';
import { Shot } from '../components/Shot';
import { S13, S14 } from '../figures';
import { SITE } from '../site';

export const Artifacts = () => (
  <Block
    headingId="h2-artifacts"
    heading="The plan does not scroll away"
    sub="Plans, reports and wireframes live next to the task, with who made them and what they were built from."
  >
    <div className="stackText">
      <p>
        A wireframe starts from scouts that read your code for screens and data, and each version
        can be compared with the one before. Here v3 of the deliveries screen adds the
        stuck-delivery banner.
      </p>
      <p>
        A report opens as a document in any browser, with where it came from one click away. A plan
        waits as Ready to run until you say go.
      </p>
      <More href={`${SITE.concepts}#plans`}>How plans work</More>
    </div>
    <Shot figure={S13} />
    <Shot figure={S14} />
  </Block>
);
