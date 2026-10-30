// Moves every page deck on the screen (components/PageDeck.astro): a dot per card, darker the more of
// it is on screen; the arrows (hidden at either end) and the Left and Right keys move a card at a time. The keys move the deck in
// view, so in the feed Up and Down go from page to page and Left and Right through the page's cards.
export function wireDecks() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const moves = new Map<HTMLElement, (d: number) => void>();
  let inView: HTMLElement | null = null;
  const watch = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) inView = e.target as HTMLElement;
    },
    { threshold: 0.5 },
  );
  for (const deck of document.querySelectorAll<HTMLElement>('[data-deck]')) {
    const wrap = deck.parentElement!;
    const cards = [...deck.querySelectorAll<HTMLElement>('.deck-card')];
    const dots = wrap.querySelector<HTMLElement>('[data-deck-dots]')!;
    dots.innerHTML = cards.map(() => '<span class="block h-1.5 w-1.5 rounded-full bg-line"></span>').join('');
    const marks = [...dots.children] as HTMLElement[];
    let current = 0;
    const prev = wrap.querySelector<HTMLButtonElement>('[data-deck-prev]')!;
    const next = wrap.querySelector<HTMLButtonElement>('[data-deck-next]')!;
    // The cards in view: on wide screens several at once. The first of them is the current one, and an
    // arrow hides when its end is already in view.
    const visible = new Set<number>([0]);
    const show = () => {
      const first = Math.min(...visible), last = Math.max(...visible);
      current = first;
      prev.disabled = first === 0;
      next.disabled = last === cards.length - 1;
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const k = cards.indexOf(e.target as HTMLElement);
          if (e.isIntersecting) visible.add(k);
          else visible.delete(k);
        }
        if (visible.size) show();
      },
      { root: deck, threshold: 0.6 },
    );
    cards.forEach((c) => io.observe(c));
    // Each dot as dark as the share of its card on screen, so the dots move with the scroll.
    const shade = () => {
      const view = deck.getBoundingClientRect();
      cards.forEach((c, k) => {
        const r = c.getBoundingClientRect();
        const seen = Math.max(0, Math.min(r.right, view.right) - Math.max(r.left, view.left)) / r.width;
        marks[k].style.background = `color-mix(in srgb, var(--fg) ${Math.round(seen * 100)}%, var(--line))`;
      });
    };
    let frame = 0;
    deck.addEventListener('scroll', () => (cancelAnimationFrame(frame), (frame = requestAnimationFrame(shade))), { passive: true });
    new ResizeObserver(shade).observe(deck);
    // Within the deck only: scrollIntoView would also move the feed around it. The card goes where it
    // snaps (centered on phones, at the start on wide screens), or the snap pulls the deck back.
    const go = (d: number) => {
      const card = cards[Math.max(0, Math.min(cards.length - 1, current + d))];
      const centered = getComputedStyle(card).scrollSnapAlign.includes('center');
      const left = card.offsetLeft - (centered ? (deck.clientWidth - card.offsetWidth) / 2 : 0);
      deck.scrollTo({ left, behavior: reduce ? 'auto' : 'smooth' });
    };
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    moves.set(deck, go);
    watch.observe(deck);
    inView ??= deck;
    show();
  }
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]')) return;
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const go = d && inView && moves.get(inView);
    if (go) (e.preventDefault(), go(d));
  });
}
