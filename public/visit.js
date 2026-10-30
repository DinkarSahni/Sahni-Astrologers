// The map URL is the embed supplied in the original business website.
// Create its iframe only after a visitor explicitly requests Google Maps.
const googleMapEmbed = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3396.7!2d75.5444857!3d31.3704301!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x391a518b76dec3fb%3A0xdf0e60998a59714f!2sSahni%20Astrologers!5e0!3m2!1sen!2sin!4v1680000000000!5m2!1sen!2sin';

export function initializeVisit() {
  const year = document.getElementById('copyright-year');
  if (year) year.textContent = String(new Date().getFullYear());
  const footer = document.querySelector('.site-footer');
  const floatingContact = document.querySelector('.whatsapp-float');
  if (footer && floatingContact && typeof window.IntersectionObserver === 'function') {
    const observer = new IntersectionObserver(([entry]) => { floatingContact.hidden = entry.isIntersecting; });
    observer.observe(footer);
  }
  const button = document.getElementById('load-google-map');
  const stage = document.getElementById('google-map-stage');
  const status = document.getElementById('google-map-status');
  if (!button || !stage || button.dataset.mapBound === 'true') return;
  button.dataset.mapBound = 'true';
  button.addEventListener('click', () => {
    const frame = document.createElement('iframe');
    frame.title = 'Google Maps location of Sahni Astrologers';
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer';
    frame.src = googleMapEmbed;
    frame.setAttribute('allowfullscreen', '');
    stage.replaceChildren(frame);
    stage.dataset.mapState = 'requested';
    if (status) status.textContent = 'Map requested from Google. If it is unavailable here, open our Google listing or directions below.';
  }, { once: true });
}
