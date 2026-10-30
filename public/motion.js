let motionCleanup;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function listenToMotionPreference(query, listener) {
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', listener);
    return () => query.removeEventListener?.('change', listener);
  }
  if (typeof query.addListener === 'function') {
    query.addListener(listener);
    return () => query.removeListener?.(listener);
  }
  return () => {};
}

function initializeStory(reducedMotion) {
  const section = document.getElementById('scrollStorySection');
  const track = document.getElementById('storyTrack');
  const viewport = section?.querySelector('.scroll-story-sticky');
  if (!section || !track || !viewport) return () => {};
  const panels = [...track.querySelectorAll('.story-panel')];
  const previous = document.getElementById('story-prev');
  const next = document.getElementById('story-next');
  const counter = document.getElementById('story-counter');
  const progress = document.getElementById('story-progress');
  let frame = 0;
  let measurementNeeded = true;
  let distance = 0;
  let start = 0;
  let visible = false;
  let index = 0;
  let pinned = false;

  const setProperty = (element, name, value) => {
    if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
  };
  const report = offset => {
    const positions = panels.map(panel => panel.offsetLeft - (panels[0]?.offsetLeft || 0));
    index = positions.reduce((closest, position, candidate) =>
      Math.abs(position - offset) < Math.abs(positions[closest] - offset) ? candidate : closest, 0);
    const count = Math.max(1, panels.length);
    if (counter) counter.textContent = `${index + 1} / ${count}`;
    if (previous) previous.disabled = offset <= 1;
    if (next) next.disabled = offset >= distance - 1;
    if (progress) {
      progress.setAttribute('aria-valuemin', '1');
      progress.setAttribute('aria-valuemax', String(count));
      progress.setAttribute('aria-valuenow', String(index + 1));
      progress.setAttribute('aria-valuetext', `Service ${index + 1} of ${count}`);
    }
    setProperty(section, '--story-progress', `${distance > 0 ? clamp(offset / distance, 0, 1) * 100 : 0}%`);
  };
  const measure = () => {
    visible = section.getClientRects().length > 0 && viewport.clientWidth > 0;
    if (!visible) return;
    pinned = !reducedMotion.matches;
    section.classList.toggle('is-story-pinned', pinned);
    section.classList.toggle('story-enhanced', pinned);
    section.classList.toggle('is-story-reduced', !pinned);
    distance = Math.max(0, track.scrollWidth - viewport.clientWidth);
    const height = Math.max(1, viewport.getBoundingClientRect().height);
    const sectionStyle = getComputedStyle(section);
    const flowOffset = (Number.parseFloat(sectionStyle.borderTopWidth) || 0)
      + (Number.parseFloat(sectionStyle.paddingTop) || 0);
    setProperty(section, '--story-distance', `${distance}px`);
    setProperty(section, '--story-height', `${distance + height + flowOffset}px`);
    // Sticky's top is set by the CSS header-height variable at every breakpoint.
    const stickyTop = Number.parseFloat(getComputedStyle(viewport).top) || 0;
    start = section.getBoundingClientRect().top + window.scrollY + flowOffset - stickyTop;
    if (pinned && viewport.scrollLeft) viewport.scrollLeft = 0;
    if (!pinned) track.style.removeProperty('transform');
    viewport.setAttribute('aria-label', pinned
      ? 'Explore our services. Scroll down or use the previous and next service buttons.'
      : 'Explore our services. Scroll sideways or use the previous and next service buttons.');
  };
  const update = () => {
    frame = 0;
    if (measurementNeeded) { measurementNeeded = false; measure(); }
    if (!visible) return;
    const offset = pinned ? clamp(window.scrollY - start, 0, distance) : viewport.scrollLeft;
    if (pinned) setProperty(track, 'transform', `translate3d(${-offset}px, 0, 0)`);
    report(offset);
  };
  const schedule = (remeasure = false) => {
    measurementNeeded ||= remeasure;
    if (!frame) frame = requestAnimationFrame(update);
  };
  const onScroll = () => schedule();
  const onResize = () => schedule(true);
  const goTo = requested => {
    measure();
    if (!visible) return;
    const target = panels[clamp(requested, 0, panels.length - 1)];
    if (!target) return;
    const offset = clamp(target.offsetLeft - panels[0].offsetLeft, 0, distance);
    if (pinned) window.scrollTo({ top: start + offset, behavior: 'smooth' });
    else viewport.scrollTo({ left: offset, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  };
  const onPrevious = () => goTo(index - 1);
  const onNext = () => goTo(index + 1);
  const onKeydown = event => {
    if (event.target !== viewport || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1
      : event.key === 'Home' ? 0 : event.key === 'End' ? panels.length - 1 : null;
    if (target === null) return;
    event.preventDefault();
    goTo(target);
  };
  const onFocus = event => {
    const panel = event.target.closest('.story-panel');
    if (panel && pinned) {
      viewport.scrollLeft = 0;
      // Tabbing to a later card keeps that focused card visible in the pinned viewport.
      const offset = clamp(panel.offsetLeft - panels[0].offsetLeft, 0, distance);
      const current = clamp(window.scrollY - start, 0, distance);
      if (Math.abs(current - offset) > 1) window.scrollTo({ top: start + offset, behavior: 'instant' });
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  viewport.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('sahni:route', onResize);
  viewport.addEventListener('keydown', onKeydown);
  viewport.addEventListener('focusin', onFocus);
  previous?.addEventListener('click', onPrevious);
  next?.addEventListener('click', onNext);
  const stopMotionChanges = listenToMotionPreference(reducedMotion, onResize);
  const resizeObserver = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(onResize) : null;
  resizeObserver?.observe(viewport);
  resizeObserver?.observe(track);
  const intersectionObserver = typeof window.IntersectionObserver === 'function'
    ? new window.IntersectionObserver(onResize, { rootMargin: '100% 0px' }) : null;
  intersectionObserver?.observe(section);
  const routeObserver = typeof window.MutationObserver === 'function' ? new window.MutationObserver(onResize) : null;
  document.querySelectorAll('[data-page]').forEach(page => routeObserver?.observe(page, { attributes: true, attributeFilter: ['hidden'] }));
  document.fonts?.ready.then(onResize);
  document.fonts?.addEventListener('loadingdone', onResize);
  schedule(true);

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', onScroll);
    viewport.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('sahni:route', onResize);
    viewport.removeEventListener('keydown', onKeydown);
    viewport.removeEventListener('focusin', onFocus);
    previous?.removeEventListener('click', onPrevious);
    next?.removeEventListener('click', onNext);
    stopMotionChanges();
    document.fonts?.removeEventListener('loadingdone', onResize);
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    routeObserver?.disconnect();
    section.classList.remove('is-story-pinned', 'story-enhanced', 'is-story-reduced');
    ['--story-distance', '--story-height', '--story-progress'].forEach(name => section.style.removeProperty(name));
    track.style.removeProperty('transform');
  };
}

function initializeReviews(reducedMotion) {
  const viewport = document.getElementById('reviews-track');
  if (!viewport) return () => {};
  const cards = [...viewport.querySelectorAll('.review-card')];
  if (!cards.length) return () => {};
  const previous = document.getElementById('reviews-prev');
  const next = document.getElementById('reviews-next');
  const status = document.getElementById('reviews-status');
  let frame = 0;
  let disposed = false;
  let first = 0;

  const maximum = () => Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  const offsets = () => cards.map(card => card.offsetLeft - cards[0].offsetLeft);
  const report = () => {
    frame = 0;
    const positions = offsets();
    first = positions.reduce((nearest, position, index) =>
      Math.abs(position - viewport.scrollLeft) < Math.abs(positions[nearest] - viewport.scrollLeft) ? index : nearest, 0);
    const viewportRect = viewport.getBoundingClientRect();
    const visible = cards.map((card, index) => ({ index, rect: card.getBoundingClientRect() }))
      .filter(({ rect }) => Math.min(rect.right, viewportRect.right) - Math.max(rect.left, viewportRect.left) > rect.width / 2);
    const firstVisible = visible[0]?.index ?? first;
    const lastVisible = visible[visible.length - 1]?.index ?? first;
    if (status) status.textContent = `${firstVisible + 1}${lastVisible > firstVisible ? `–${lastVisible + 1}` : ''} of ${cards.length}`;
    if (previous) previous.disabled = viewport.scrollLeft <= 2;
    if (next) next.disabled = viewport.scrollLeft >= maximum() - 2;
  };
  const scheduleReport = () => { if (!disposed && !frame) frame = requestAnimationFrame(report); };
  const goTo = index => {
    const position = offsets()[clamp(index, 0, cards.length - 1)];
    viewport.scrollTo({ left: clamp(position, 0, maximum()), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  };
  const goPrevious = () => { report(); goTo(first - 1); };
  const goNext = () => { report(); goTo(first + 1); };
  const onKeydown = event => {
    if (event.target !== viewport || event.altKey || event.ctrlKey || event.metaKey) return;
    report();
    const requested = event.key === 'ArrowLeft' ? first - 1 : event.key === 'ArrowRight' ? first + 1
      : event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : null;
    if (requested === null) return;
    event.preventDefault();
    goTo(requested);
  };
  const resizeObserver = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(scheduleReport) : null;
  resizeObserver?.observe(viewport);
  cards.forEach(card => resizeObserver?.observe(card));
  viewport.setAttribute('aria-roledescription', 'carousel');
  previous?.addEventListener('click', goPrevious);
  next?.addEventListener('click', goNext);
  viewport.addEventListener('scroll', scheduleReport, { passive: true });
  viewport.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', scheduleReport, { passive: true });
  window.addEventListener('sahni:route', scheduleReport);
  const stopMotionChanges = listenToMotionPreference(reducedMotion, scheduleReport);
  document.fonts?.ready.then(scheduleReport);
  scheduleReport();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObserver?.disconnect();
    previous?.removeEventListener('click', goPrevious);
    next?.removeEventListener('click', goNext);
    viewport.removeEventListener('scroll', scheduleReport);
    viewport.removeEventListener('keydown', onKeydown);
    window.removeEventListener('resize', scheduleReport);
    window.removeEventListener('sahni:route', scheduleReport);
    stopMotionChanges();
  };
}

export function initializeMotion() {
  if (motionCleanup) return motionCleanup;
  const reducedMotion = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: true };
  const cleanupStory = initializeStory(reducedMotion);
  const cleanupReviews = initializeReviews(reducedMotion);
  motionCleanup = () => { cleanupStory(); cleanupReviews(); motionCleanup = undefined; };
  return motionCleanup;
}
