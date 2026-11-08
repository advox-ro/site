// What a link preview drawn in the Worker needs (og-wiki.ts): the look of scripts/build-og.mjs. Satori
// lays out the text, resvg turns it into a PNG. Both need WebAssembly, imported as modules: Workers
// can't compile WebAssembly at runtime. That's also why this is satori 0.12 ("satori-wasm"): 0.62,
// used by the build script, compiles its text shaper on the fly.
import { initWasm as initResvg } from '@resvg/resvg-wasm';
import { init as initSatori } from 'satori-wasm/wasm';
import initYoga from 'yoga-wasm-web';
import yogaWasm from 'yoga-wasm-web/dist/yoga.wasm?module';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm?module';
import displayLatin from '@fontsource/outfit/files/outfit-latin-900-normal.woff?inline';
import displayExt from '@fontsource/outfit/files/outfit-latin-ext-900-normal.woff?inline';
import monoLatin from '@fontsource/outfit/files/outfit-latin-600-normal.woff?inline';
import monoExt from '@fontsource/outfit/files/outfit-latin-ext-600-normal.woff?inline';
import { advoxSvg } from './advox-logo.mjs';

const C_LOGO = { fg: '#121210', acc: '#d4ff3a' };
// The advox wordmark (paper version), as an image satori places like any element.
export const LOGO_SRC = `data:image/svg+xml;base64,${btoa(advoxSvg({ colors: { ink: C_LOGO.fg, vox: C_LOGO.fg, acc: C_LOGO.acc } }))}`;

export const W = 1200, H = 630;
export const C = { bg: '#f2efe7', fg: '#121210', dim: 'rgba(18,18,16,0.6)' };

// Fonts arrive as data: URLs (?inline); satori wants bytes. "Ș"/"ț" live only in the latin-ext
// subsets, and satori falls back per glyph across families, so each subset has its own name.
const bytes = (dataUrl: string) => Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (c) => c.charCodeAt(0)).buffer;
type Fonts = { name: string; data: ArrayBuffer; weight: 500 | 900 }[];
let ready: Promise<Fonts> | undefined;
export const setup = () =>
  (ready ??= Promise.all([
    initYoga(yogaWasm).then(initSatori),
    // Already set up (the dev server reloads this module, not resvg's) is fine.
    initResvg(resvgWasm).catch((e: Error) => { if (!/Already initialized/.test(e.message)) throw e; }),
  ]).then(() => [
    { name: 'Display', data: bytes(displayLatin), weight: 900 },
    { name: 'DisplayExt', data: bytes(displayExt), weight: 900 },
    { name: 'Mono', data: bytes(monoLatin), weight: 500 },
    { name: 'MonoExt', data: bytes(monoExt), weight: 500 },
  ] as Fonts));
export const DISPLAY = 'Display, DisplayExt', MONO = 'Mono, MonoExt';

// Minimal element helper, so no JSX is needed.
type Node = { type: string; props: { style: Record<string, unknown>; children: (Node | string)[] } };
export const h = (type: string, style: Record<string, unknown>, ...children: (Node | string | (Node | string)[])[]): Node => ({
  type,
  props: { style: { display: 'flex', boxSizing: 'border-box', ...style }, children: children.flat() },
});
