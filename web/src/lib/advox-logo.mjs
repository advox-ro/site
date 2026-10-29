// The advox wordmark, heavy weight: "ad" in ink, "vox" as the vote (V a tick, O the box,
// X a cross) on a lime selection. V and X are cropped to their squares; the V's arms rise at the
// same angle (56.76°), and its inner corner
// sits level with the bottom of the O's counter. One source for the header, favicon and
// social images.

export const ADVOX_VIEWBOX = '0 -38 438.28 154';
export const ADVOX_RATIO = 438.28 / 154;

/**
 * The logo as an SVG string.
 * - colors: { ink, vox, acc } draws it in fixed colours (social images); acc null = no selection.
 * - colors omitted: draws with the classes advox-ink / advox-vox / advox-sel, themed in global.css.
 */
export function advoxSvg({ colors, id = 'advox', attrs = '' } = {}) {
  const fill = (cls, c) => (colors ? `fill="${c}"` : `class="${cls}"`);
  const stroke = (cls, c) => (colors ? `stroke="${c}"` : `class="${cls}"`);
  const sel = colors
    ? colors.acc ? `<rect x="175" y="-38" width="263.28" height="154" fill="${colors.acc}"/>` : ''
    : `<rect class="advox-sel" x="175" y="-38" width="263.28" height="154"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ADVOX_VIEWBOX}" ${attrs}>`
    + `<defs><clipPath id="${id}-x"><rect x="351.28" y="10" width="82" height="82"/></clipPath></defs>`
    + sel
    + `<g fill="none" stroke-width="24" stroke-linecap="butt" stroke-linejoin="miter">`
    + `<path ${stroke('advox-ink', colors?.ink)} d="M68 92V50A28 28 0 0 0 12 50A28 28 0 0 0 68 50"/>`
    + `<path ${stroke('advox-ink', colors?.ink)} d="M158-32V50A28 28 0 0 1 102 50A28 28 0 0 1 158 50V92"/>`
    + `<polygon ${fill('advox-vox-f', colors?.vox)} stroke="none" points="206.87,66 243.56,10 262,10 262,25.65 218.52,92 195.21,92 180,68.79 180,25"/>`
    + `<circle ${stroke('advox-vox', colors?.vox)} cx="307.15" cy="50" r="28"/>`
    + `<g clip-path="url(#${id}-x)">`
    + `<line ${stroke('advox-vox', colors?.vox)} x1="310.28" y1="-31" x2="474.28" y2="133"/>`
    + `<line ${stroke('advox-vox', colors?.vox)} x1="310.28" y1="133" x2="474.28" y2="-31"/>`
    + `</g></g></svg>`;
}
