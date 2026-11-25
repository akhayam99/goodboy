import { acceptedCategory } from 'vanilla-cookieconsent';

export const reportPreference = () => {
  const consent: unknown = Reflect.get(window, 'goodboyConsent');
  if (typeof consent !== 'object' || consent === null) {
    return;
  }
  const onPreference: unknown = Reflect.get(consent, 'onPreference');
  if (typeof onPreference !== 'function') {
    return;
  }
  onPreference.call(consent, { isMeasurementGranted: acceptedCategory('analytics') });
};
