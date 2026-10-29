// Link preview for a wiki page (/og/wiki/<slug>.png, 1200×630): the wordmark and "Wiki", the page's
// title, Romania's dots top right. The look of the wiki index's own image (scripts/build-og.mjs),
// drawn in the Worker like a result's preview (og-result.ts): the pages come from the redactor.
import { Resvg } from '@resvg/resvg-wasm';
import satori from 'satori-wasm/wasm';
import { DOTS, DOT_VIEW } from '../data/dots';
import { ADVOX_RATIO } from './advox-logo.mjs';
import { C, DISPLAY, H, LOGO_SRC, MONO, W, h, setup } from './og-result';

const PAD = 72;
const DOT = 'rgba(18,18,16,0.2)';

/** Romania's dots as SVG circles, placed at (x, y) with the given width. */
function mapSvg(x: number, y: number, width: number) {
  const s = width / DOT_VIEW.width, r = (DOT_VIEW.step * 0.27).toFixed(2);
  let circles = '';
  for (let i = 0; i < DOTS.length; i += 3) circles += `<circle cx="${DOTS[i].toFixed(1)}" cy="${DOTS[i + 1].toFixed(1)}" r="${r}"/>`;
  return `<g transform="translate(${x} ${y}) scale(${s.toFixed(4)})" fill="${DOT}">${circles}</g>`;
}

export async function renderWikiPreview(title: string) {
  const fonts = await setup();
  // The title wraps up to three lines; lineHeight 1.24 so the deep comma under Ș/Ț clears the next line.
  const tree = h(
    'div',
    { width: W, height: H, padding: PAD, flexDirection: 'column', justifyContent: 'space-between' },
    h(
      'div',
      { alignItems: 'center', gap: 24 },
      { type: 'img', props: { src: LOGO_SRC, width: Math.round(60 * ADVOX_RATIO), height: 60, style: { display: 'flex' } } } as never,
      h('div', { fontFamily: MONO, fontSize: 20, letterSpacing: '0.18em', color: C.dim, textTransform: 'uppercase' }, 'Wiki'),
    ),
    h('div', { maxWidth: 900, flexWrap: 'wrap', fontFamily: DISPLAY, fontWeight: 900, fontSize: title.length > 34 ? 84 : 104, lineHeight: 1.24, color: C.fg, textTransform: 'uppercase' }, title),
  );
  let out = await satori(tree as never, { width: W, height: H, fonts });
  // Background first, then the map, then satori's text on top.
  out = out.replace(/^(<svg[^>]*>)/, `$1<rect width="${W}" height="${H}" fill="${C.bg}"/>${mapSvg(W - PAD - 300, PAD - 6, 300)}`);
  return new Resvg(out, { fitTo: { mode: 'width', value: W } }).render().asPng();
}
