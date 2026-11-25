import { SITE } from '../../../lib/site';
import type { LegalSection } from './LegalSection';

export const COOKIE_SECTIONS: readonly LegalSection[] = [
  {
    heading: 'What a tracker is',
    paragraphs: [
      'A tracker is a cookie, or a similar technology such as a script, a web beacon or local storage, that stores or reads information on your device. A first-party tracker is set by this site. A third-party tracker comes from another provider.',
    ],
  },
  {
    heading: 'Necessary',
    paragraphs: ['These keep the site working and need no consent. They hold no personal data.'],
    items: [
      'goodboy_consent, a first-party cookie that remembers your choice on the banner. It lasts 6 months.',
      'goodboy-site:theme, an entry in your browser local storage that remembers whether you picked the light or the dark theme.',
    ],
  },
  {
    heading: 'Measurement',
    paragraphs: [
      'Measurement counts visitors and sessions to analyze traffic and behavior and improve the site. It loads only after you accept.',
    ],
    items: [
      'Google Tag Manager, provided by Google Ireland Limited (Ireland), loads the Google Analytics tag. It processes usage data and trackers.',
      'Google Analytics 4, provided by Google Ireland Limited (Ireland), processes usage data, number of users, session statistics and trackers. It sets _ga and _ga_*, both lasting 2 years. Google deletes IP addresses before the data is recorded, and it may use the data to contextualize and personalize ads in its own advertising network.',
    ],
  },
  {
    heading: 'Counted without a cookie',
    paragraphs: [
      'The site and the demo at demo.goodboy-ai.dev count page views with Vercel Web Analytics, which sets no cookie. It tells visits apart with a hash made from the request, which resets every day. It runs without consent because it stores nothing on your device.',
    ],
  },
  {
    heading: 'Manage your choice',
    paragraphs: [
      'Open Cookie settings in the footer of any page to accept, refuse or change measurement. If you withdraw after accepting, the page reloads without Google, and the Google Analytics cookies are removed.',
      'You can also view, block or delete cookies in your browser settings. Browser settings do not let you choose by category.',
    ],
  },
  {
    heading: 'If you refuse',
    paragraphs: [
      'You are free to accept or refuse. Refusing measurement changes nothing you can see on the site.',
    ],
  },
  {
    heading: 'More',
    paragraphs: [
      `The privacy policy at ${SITE.origin}${SITE.privacy} explains what is collected, why, and your rights. Write to ${SITE.controller.email} with any question.`,
    ],
  },
];
