import { SITE } from '../../../lib/site';
import type { LegalSection } from './LegalSection';

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    heading: 'Who is responsible',
    paragraphs: [
      `The data controller is ${SITE.controller.name}, operator of goodboy-ai.dev. You can write to ${SITE.controller.email} about anything in this policy.`,
      'This policy covers the website at goodboy-ai.dev. The Goodboy desktop app runs on your machine, has no server in the middle and sends no telemetry.',
    ],
  },
  {
    heading: 'What is collected',
    paragraphs: [
      'The site collects usage data automatically when you visit: the pages you open, number of users, session statistics and the data that tracking tools such as cookies produce. Server logs kept for operation and maintenance may include IP addresses.',
      'Without your consent, the site counts page views with the Vercel Web Analytics counter, which sets no cookie and tells visits apart with a hash made from the request that resets every day. The mock-data demo at demo.goodboy-ai.dev does the same.',
      'With your consent, the site also loads Google Tag Manager and Google Analytics 4, which set cookies and collect usage data. If you refuse or do not answer, nothing from Google loads.',
    ],
  },
  {
    heading: 'Why it is processed',
    paragraphs: ['The data is processed for these purposes:'],
    items: [
      'hosting and backend infrastructure',
      'tag management',
      'statistics: understanding how many people visit and how they use the site',
      'meeting legal obligations, answering requests from authorities, protecting rights and interests, and detecting malicious or fraudulent activity',
    ],
  },
  {
    heading: 'Legal bases',
    paragraphs: [
      'Measurement with Google Tag Manager and Google Analytics rests on your consent. You can withdraw it at any time with Cookie settings in the footer of any page, and the page then stops loading Google.',
      'For the rest, the bases the General Data Protection Regulation allows are consent, performance of a contract or pre-contract measures, a legal obligation, a task in the public interest, and the legitimate interest of the controller or a third party.',
    ],
  },
  {
    heading: 'Who processes it with us',
    paragraphs: ['Access may be granted to providers that run the site for us:'],
    items: [
      'Vercel Inc. (United States) hosts the site and provides the cookieless visit counter. It processes usage data as described in Vercel privacy policy.',
      'Google Ireland Limited (Ireland) provides Google Tag Manager, to manage tags and scripts, and Google Analytics 4, to analyze traffic and behavior. They process usage data, number of users, session statistics and tracking tools, and only after you accept. Google deletes IP addresses before the data is recorded in a data center, and it may use the data to contextualize and personalize ads in its own advertising network.',
    ],
  },
  {
    heading: 'Where it is processed',
    paragraphs: [
      'Data is processed at the controller operating sites and wherever the parties involved are located. It may be transferred to a country other than yours. Vercel servers can be geographically distributed, so the exact place where data is stored may be hard to name.',
    ],
  },
  {
    heading: 'How long it is kept',
    paragraphs: [
      'Data is kept as long as the purpose it was collected for needs it, or longer when the law requires it. Data based on your consent is kept until you withdraw it, and is deleted when the period ends.',
      'The Google Analytics cookies last 2 years. The record of your cookie choice on this site lasts 6 months, after which the banner asks again.',
    ],
  },
  {
    heading: 'Your rights',
    paragraphs: [
      'You can exercise these rights free of charge. Write to the controller and expect an answer within one month:',
    ],
    items: [
      'withdraw your consent at any time',
      'object to processing',
      'access your data',
      'have inaccurate data corrected',
      'restrict processing',
      'have your data erased',
      'receive your data in a portable format, or have it sent to another controller',
      'lodge a complaint with a supervisory authority, or go to court',
    ],
  },
  {
    heading: 'Visitors from Switzerland and Brazil',
    paragraphs: [
      'Under the Swiss Federal Act on Data Protection you can ask for access, object to processing (including restriction, erasure or destruction, and blocking disclosure to third parties), ask for portability and have inaccurate data corrected.',
      'Under the Brazilian General Data Protection Law you can ask whether your data is processed and for access, correction, anonymization, blocking or deletion of unnecessary data, information about who it is shared with, portability and revocation of consent, and you can complain to the national authority.',
    ],
  },
  {
    heading: 'Legal use and changes',
    paragraphs: [
      'Data may be used in legal proceedings to defend against misuse of the site, and the controller may have to disclose it to public authorities.',
      'This policy can change. The date at the top shows the latest version, and where the law requires it your consent is asked again.',
    ],
  },
];
