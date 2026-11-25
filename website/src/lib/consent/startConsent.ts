import { run } from 'vanilla-cookieconsent';
import { CONSENT_CONFIG } from './CONSENT_CONFIG';
import { reportPreference } from './reportPreference';

let isStarted = false;

export const startConsent = () => {
  if (isStarted) {
    return;
  }
  isStarted = true;
  void run({ ...CONSENT_CONFIG, onConsent: reportPreference, onChange: reportPreference });
};
