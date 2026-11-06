import { createMascot } from './createMascot.mjs';

export const createLockupHtml = ({ mascotBase64, tagline = '' }) => `
  <div class="lockup">
    ${createMascot({ className: 'mascot', mascotBase64 })}
    <div class="lockup-copy">
      <span>Goodboy</span>
      ${tagline === '' ? '' : `<small>${tagline}</small>`}
    </div>
  </div>`;
