import { Block } from '../components/Block';
import { More } from '../components/More';
import { SeeHow } from '../components/SeeHow';
import { PhoneFigure } from '../components/PhoneFigure';
import { Shot } from '../components/Shot';
import { COMPARE, PHONE_REPORT } from '../figures';
import { SITE } from '../site';

export const Artifacts = () => (
  <Block
    id="artifacts"
    headingId="h2-artifacts"
    heading="Plans, reports and wireframes"
    sub="The plan does not scroll away. It lives next to the task, with who made it and what it came from."
    phone={<PhoneFigure shot={PHONE_REPORT} />}
  >
    <Shot figure={COMPARE} />
    <div className="stackText">
      <p>
        A plan waits as Ready to run until you say go. A report opens as a document in any browser,
        with its sources one click away.
      </p>
      <p>
        A wireframe starts from scouts that read your code, and each version can be compared with
        the last. Here v3 of the deliveries screen adds the stuck-delivery banner.
      </p>
      <div className="linkRow">
        <More href={`${SITE.concepts}#artifacts`}>How artifacts work</More>
        <SeeHow anchor="plans-reports-and-wireframes" />
      </div>
    </div>
  </Block>
);
