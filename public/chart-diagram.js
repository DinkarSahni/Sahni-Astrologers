const NS = 'http://www.w3.org/2000/svg';
const LABELS = {
  en: { Sun: 'Su', Moon: 'Mo', Mercury: 'Me', Venus: 'Ve', Mars: 'Ma', Jupiter: 'Ju', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke' },
  hi: { Sun: 'सू', Moon: 'चं', Mercury: 'बु', Venus: 'शु', Mars: 'मं', Jupiter: 'गु', Saturn: 'श', Rahu: 'रा', Ketu: 'के' },
};
const number = (value, language) => new Intl.NumberFormat(language === 'hi' ? 'hi-IN-u-nu-deva' : 'en-IN', { useGrouping: false }).format(value);
const element = (tag, attributes = {}, text) => {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
};

/** Each layout uses the same sign placements; only the drawing changes. */
export function createChartDiagram(chart, { language = 'en', style = 'north', division = 'D1' } = {}) {
  if (!chart || !Array.isArray(chart.planets) || !Number.isInteger(chart.ascendant?.signIndex)) throw new Error('A calculated chart is required.');
  if (!['north', 'south'].includes(style) || !['en', 'hi'].includes(language)) throw new Error('Unsupported chart display.');
  const title = language === 'hi'
    ? `${style === 'north' ? 'उत्तर' : 'दक्षिण'} भारतीय ${division} कुंडली। ग्रहों की स्थिति तालिका में भी दी गई है।`
    : `${style === 'north' ? 'North' : 'South'} Indian ${division} chart. Planetary positions are also available in the table.`;
  const svg = element('svg', { viewBox: '0 0 400 400', class: 'chart-wheel', role: 'img', 'aria-label': title, 'data-chart-style': style, 'data-division': division });
  svg.append(element('title', {}, title));
  const lagna = chart.ascendant.signIndex;
  const appendPlacements = (sign, x, y) => {
    const planets = chart.planets.filter(planet => planet.signIndex === sign);
    const labels = planets.map(planet => `${LABELS[language][planet.name] || planet.name.slice(0, 2)}${planet.motionUncertain || planet.natal?.motionUncertain ? ' ?' : planet.retrograde ? ' ℞' : ''}`);
    const fontSize = labels.length > 6 ? 9 : 11;
    for (let row = 0; row < Math.ceil(labels.length / 3); row++) {
      svg.append(element('text', { x, y: y + row * 13, 'text-anchor': 'middle', ...(fontSize === 9 ? { class: 'chart-planet-small' } : {}) }, labels.slice(row * 3, row * 3 + 3).join(' ')));
    }
  };
  if (style === 'north') {
    svg.append(element('path', { d: 'M1 1H399V399H1ZM0 0L400 400M400 0L0 400M200 0L400 200L200 400L0 200Z', fill: 'none', stroke: '#a48a50', 'stroke-width': 1 }));
    const points = [[200,100],[100,42],[42,100],[100,200],[42,300],[100,358],[200,300],[300,358],[358,300],[300,200],[358,100],[300,42]];
    points.forEach(([x, y], house) => {
      const sign = (lagna + house) % 12;
      svg.append(element('text', { x, y: y - 14, 'text-anchor': 'middle', class: 'chart-house' }, `${number(sign + 1, language)} · ${language === 'hi' ? 'भा' : 'H'}${number(house + 1, language)}`));
      appendPlacements(sign, x, y + 5);
    });
  } else {
    // South Indian charts keep signs fixed, with Pisces in the upper-left cell.
    const cells = [[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[2,3],[1,3],[0,3],[0,2],[0,1],[0,0]];
    cells.forEach(([column, row], sign) => {
      const x = column * 100, y = row * 100, house = (sign - lagna + 12) % 12 + 1;
      svg.append(element('rect', { x: x + 0.5, y: y + 0.5, width: 99, height: 99, fill: 'none', stroke: '#a48a50', 'stroke-width': 1 }));
      svg.append(element('text', { x: x + 50, y: y + 20, 'text-anchor': 'middle', class: 'chart-house' }, `${number(sign + 1, language)} · ${language === 'hi' ? 'भा' : 'H'}${number(house, language)}${sign === lagna ? language === 'hi' ? ' · लग्न' : ' · Asc' : ''}`));
      appendPlacements(sign, x + 50, y + 46);
    });
    svg.append(element('text', { x: 200, y: 183, 'text-anchor': 'middle', class: 'chart-centre-brand' }, 'Sahni Astrologers'));
    svg.append(element('text', { x: 200, y: 218, 'text-anchor': 'middle', class: 'chart-centre-division' }, division));
    svg.append(element('text', { x: 200, y: 246, 'text-anchor': 'middle', class: 'chart-house' }, language === 'hi' ? 'पूर्ण राशि भाव' : 'Whole-sign houses'));
  }
  return svg;
}
