import { SERVICES } from './catalog.js';

const pages = {
  '/': ['Vedic Astrology Since 1952 | Jalandhar', 'A family tradition of Vedic astrology since 1952 in Jalandhar. Explore personal consultations, Kundali matching, and Teva preparation.'],
  '/services': ['Our Services', 'Compare Kundali readings, marriage matching, career consultations, and digital or printed Tevas. See prices and what to prepare.'],
  '/about': ['Our Family Story', 'Discover the family tradition behind Sahni Astrologers, a Vedic astrology practice established in Jalandhar in 1952.'],
  '/birth-chart': ['Free Birth Chart', 'Calculate a private sidereal birth chart on your device, with planetary placements, divisional charts, and Vimshottari periods.'],
  '/contact': ['Contact & Directions', 'Call Sahni Astrologers at +91 94652 45577. Find confirmed visiting hours and directions to 124 Janta Colony, Jalandhar, Punjab 144008.'],
  '/faq': ['Frequently Asked Questions', 'Answers about consultations, birth details, Teva delivery, appointments, payments, and the free birth-chart calculator.'],
  '/privacy': ['Privacy Policy', 'How Sahni Astrologers handles enquiries, consultation details, payments, and private birth-chart calculations.'],
  '/terms': ['Booking Terms & Refunds', 'Read booking, cancellation, refund, and Teva delivery terms for Sahni Astrologers.'],
  '/disclaimer': ['Astrology & Chart Disclaimer', 'Understand the scope of traditional astrology, the free Kundali calculator, client reviews, and professional guidance.'],
  '/booking': ['Book a Reading', 'Choose your service and appointment with Sahni Astrologers in Jalandhar.'],
};
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function publicOrigin(config) {
  try {
    const url = new URL(config.siteUrl);
    if (config.nodeEnv !== 'production' || url.protocol !== 'https:' || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash
      || /^(?:localhost|127\.|0\.|\[|::)/i.test(url.hostname)
      || /\.(?:localhost|local|invalid|test|example)$/i.test(url.hostname)) return null;
    return url.origin;
  } catch { return null; }
}

export function pageMetadata(path) {
  if (pages[path]) return { title: `Sahni Astrologers — ${pages[path][0]}`, description: pages[path][1], index: path !== '/booking' };
  const service = SERVICES.find(item => path === `/services/${item.id}`);
  return service ? { title: `Sahni Astrologers — ${service.name}`, description: `Explore ${service.name} at Sahni Astrologers, Jalandhar. See the price, what is included, and how to prepare.`, index: true }
    : { title: 'Sahni Astrologers — Page Not Found', description: 'Find services, contact details, and consultations at Sahni Astrologers, Jalandhar.', index: false, notFound: true };
}

export function renderPublicPage(html, config, path) {
  const metadata = pageMetadata(path);
  const origin = publicOrigin(config);
  const title = escapeHtml(metadata.title), description = escapeHtml(metadata.description);
  const robots = origin && metadata.index ? 'index, follow' : 'noindex, nofollow';
  let result = html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${title}</title>`)
    .replace(/<meta name="description"[^>]*>/i, () => `<meta name="description" content="${description}">`)
    .replace(/<meta property="og:title"[^>]*>/i, () => `<meta property="og:title" content="${title}">`)
    .replace(/<meta property="og:description"[^>]*>/i, () => `<meta property="og:description" content="${description}">`)
    .replace(/<meta name="robots"[^>]*>/i, () => `<meta name="robots" content="${robots}">`);
  if (origin && !metadata.notFound) {
    const url = escapeHtml(new URL(path, origin).href);
    result = result.replace('</head>', () => `  <meta name="site-origin" content="${escapeHtml(origin)}">\n  <link rel="canonical" href="${url}">\n  <meta property="og:url" content="${url}">\n</head>`);
  }
  return { html: result, status: metadata.notFound ? 404 : 200, robots };
}

export function robotsText(config) {
  const origin = publicOrigin(config);
  return origin ? `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /booking\nSitemap: ${origin}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';
}

export function sitemapXml(config) {
  const origin = publicOrigin(config);
  if (!origin) return null;
  const paths = [...Object.keys(pages).filter(path => path !== '/booking'), ...SERVICES.map(service => `/services/${service.id}`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(path => `  <url><loc>${escapeHtml(new URL(path, origin).href)}</loc></url>`).join('\n')}\n</urlset>\n`;
}
