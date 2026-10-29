// Which voter this browser is (lib/set-store.ts): its id, in an HttpOnly cookie. Server only.
import type { AstroCookies } from 'astro';

// SameSite=Lax: never sent with another site's POST. Browsers keep a cookie at most 400 days; it
// is set again on every quiz sent.
export const VOTER_COOKIE = 'voter';
const MAX_AGE = 400 * 24 * 60 * 60;

export const voterId = (cookies: AstroCookies) => cookies.get(VOTER_COOKIE)?.value ?? '';

export function setVoter(cookies: AstroCookies, url: URL, id: string) {
  cookies.set(VOTER_COOKIE, id, { path: '/', sameSite: 'lax', secure: url.hostname !== 'localhost', maxAge: MAX_AGE, httpOnly: true });
}
