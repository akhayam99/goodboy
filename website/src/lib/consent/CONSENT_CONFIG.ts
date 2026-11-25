import type { CookieConsentConfig } from 'vanilla-cookieconsent';
import { SITE } from '../site';

export const CONSENT_CONFIG = {
  hideFromBots: false,
  cookie: { name: 'goodboy_consent', expiresAfterDays: 180, sameSite: 'Lax' },
  guiOptions: {
    consentModal: {
      layout: 'box inline',
      position: 'bottom left',
      equalWeightButtons: true,
      flipButtons: false,
    },
    preferencesModal: { layout: 'box', equalWeightButtons: true, flipButtons: false },
  },
  categories: {
    necessary: { enabled: true, readOnly: true },
    analytics: {
      autoClear: { cookies: [{ name: /^_ga/ }] },
    },
  },
  language: {
    default: 'en',
    translations: {
      en: {
        consentModal: {
          title: 'Your choice on measurement',
          description: `Goodboy counts visits with Google Analytics, only if you accept. Until then nothing from Google loads. <a href="${SITE.privacy}">Privacy policy</a> and <a href="${SITE.cookies}">cookie policy</a>.`,
          acceptAllBtn: 'Accept all',
          acceptNecessaryBtn: 'Reject all',
          showPreferencesBtn: 'Preferences',
        },
        preferencesModal: {
          title: 'Cookie preferences',
          acceptAllBtn: 'Accept all',
          acceptNecessaryBtn: 'Reject all',
          savePreferencesBtn: 'Save preferences',
          closeIconLabel: 'Close',
          sections: [
            {
              title: 'How Goodboy uses cookies',
              description: `You can accept or refuse measurement, and change your mind at any time from Cookie settings in the footer. More in the <a href="${SITE.privacy}">privacy policy</a> and the <a href="${SITE.cookies}">cookie policy</a>.`,
            },
            {
              title: 'Necessary',
              description:
                'Keeps your choice on this banner. Always on, and it holds no personal data.',
              linkedCategory: 'necessary',
            },
            {
              title: 'Measurement',
              description:
                'Google Tag Manager and Google Analytics 4 count visitors and sessions so the site can improve. They load only after you accept.',
              linkedCategory: 'analytics',
              cookieTable: {
                headers: { name: 'Name', description: 'Purpose', duration: 'Duration' },
                body: [
                  { name: '_ga', description: 'Tells visitors apart', duration: '2 years' },
                  { name: '_ga_*', description: 'Keeps the session state', duration: '2 years' },
                ],
              },
            },
          ],
        },
      },
    },
  },
} as const satisfies CookieConsentConfig;
