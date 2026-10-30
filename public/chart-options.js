const COPY = {
  en: {
    title: 'Calculation & display settings', node: 'Rahu / Ketu calculation', style: 'Chart layout',
    mean: 'Mean lunar node', true: 'True node · osculating approximation', north: 'North Indian · fixed houses', south: 'South Indian · fixed signs',
    meanShort: 'Mean node', trueShort: 'True node approx.', northShort: 'North Indian', southShort: 'South Indian',
    nodeHelp: 'Mean nodes smooth the lunar motion; true-node mode approximates its changing instantaneous position. Match this setting when comparing another chart.',
    styleHelp: 'Both layouts show the same calculated positions. Changing the layout does not change the Kundali.',
    ayanamsaLabel: 'Ayanamsa', ayanamsaValue: 'Lahiri approximation', houseLabel: 'House system', houseValue: 'Whole sign',
    dashaYear: 'Dasha year length', julianYear: '365.25 days · Julian year', traditionalYear: '360 days · traditional year',
    dashaHelp: 'Year length changes Dasha dates. Match the convention used in the chart you are comparing.',
    help: 'Your selected settings accompany the results and saved chart. Changing the node or Dasha-year convention requires a new calculation.',
    nodeError: 'Choose either the mean or true lunar node.', styleError: 'Choose a North Indian or South Indian chart layout.', dashaError: 'Choose a supported Dasha year length.',
  },
  hi: {
    title: 'गणना और कुंडली का स्वरूप', node: 'राहु / केतु की गणना', style: 'कुंडली का स्वरूप',
    mean: 'मध्यम चन्द्र नोड', true: 'वास्तविक नोड · तात्कालिक कक्षा का सन्निकटन', north: 'उत्तर भारतीय · स्थिर भाव', south: 'दक्षिण भारतीय · स्थिर राशियाँ',
    meanShort: 'मध्यम नोड', trueShort: 'वास्तविक नोड का सन्निकटन', northShort: 'उत्तर भारतीय', southShort: 'दक्षिण भारतीय',
    nodeHelp: 'मध्यम नोड चन्द्र गति का औसत रूप है; वास्तविक नोड पद्धति उसकी बदलती तात्कालिक स्थिति का सन्निकटन है। दूसरी कुंडली से तुलना करते समय यही पद्धति चुनें।',
    styleHelp: 'दोनों स्वरूपों में गणना की गई ग्रह स्थिति समान रहती है। स्वरूप बदलने से कुंडली की गणना नहीं बदलती।',
    ayanamsaLabel: 'अयनांश', ayanamsaValue: 'लाहिड़ी अयनांश का सन्निकटन', houseLabel: 'भाव पद्धति', houseValue: 'पूर्ण राशि भाव',
    dashaYear: 'दशा वर्ष की अवधि', julianYear: '३६५.२५ दिन · जूलियन वर्ष', traditionalYear: '३६० दिन · पारंपरिक वर्ष',
    dashaHelp: 'वर्ष की अवधि से दशा की तारीखें बदलती हैं। तुलना करते समय दूसरी कुंडली में उपयोग की गई पद्धति चुनें।',
    help: 'चुनी हुई पद्धति परिणाम और सहेजी गई कुंडली के साथ दी जाती है। नोड या दशा वर्ष बदलने पर कुंडली की दोबारा गणना करें।',
    nodeError: 'मध्यम या वास्तविक चन्द्र नोड चुनें।', styleError: 'उत्तर भारतीय या दक्षिण भारतीय कुंडली का स्वरूप चुनें।', dashaError: 'दशा वर्ष की समर्थित अवधि चुनें।',
  },
};
const mounted = new WeakMap();

/** Calculation choices and display preferences are intentionally separate. */
export function initializeChartOptions({ language: initialLanguage = 'en', onChange = () => {} } = {}) {
  const root = document.getElementById('chart-calculation-options');
  const nodeControl = document.getElementById('chart-node-mode');
  const styleControl = document.getElementById('chart-style');
  const dashaControl = document.getElementById('chart-dasha-year');
  if (!root || !nodeControl || !styleControl || !dashaControl) throw new Error('Chart settings controls are missing.');
  if (mounted.has(root)) return mounted.get(root);
  let language = initialLanguage === 'hi' ? 'hi' : 'en';
  const put = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
  const value = () => {
    if (!['mean', 'true'].includes(nodeControl.value)) throw new Error(COPY[language].nodeError);
    if (!['365.25', '360'].includes(dashaControl.value)) throw new Error(COPY[language].dashaError);
    return { node: nodeControl.value, ayanamsa: 'lahiri', dashaYearDays: Number(dashaControl.value) };
  };
  const style = () => {
    if (!['north', 'south'].includes(styleControl.value)) throw new Error(COPY[language].styleError);
    return styleControl.value;
  };
  const caption = () => {
    const copy = COPY[language];
    put('chart-options-caption', `${copy[`${value().node}Short`]} · ${copy[`${style()}Short`]}`);
  };
  const notify = kind => {
    caption();
    onChange({ kind, ...value(), style: style() });
  };
  function updateLanguage(next) {
    language = next === 'hi' ? 'hi' : 'en';
    const copy = COPY[language];
    root.lang = language;
    for (const [id, key] of [
      ['chart-options-title', 'title'], ['chart-node-help', 'nodeHelp'], ['chart-style-help', 'styleHelp'],
      ['chart-ayanamsa-label', 'ayanamsaLabel'], ['chart-ayanamsa-value', 'ayanamsaValue'],
      ['chart-house-system-label', 'houseLabel'], ['chart-house-system-value', 'houseValue'], ['chart-options-help', 'help'],
      ['chart-dasha-year-help', 'dashaHelp'],
    ]) put(id, copy[key]);
    const nodeLabel = document.querySelector('label[for="chart-node-mode"]');
    const styleLabel = document.querySelector('label[for="chart-style"]');
    if (nodeLabel) nodeLabel.textContent = copy.node;
    if (styleLabel) styleLabel.textContent = copy.style;
    const dashaLabel = document.querySelector('label[for="chart-dasha-year"]');
    if (dashaLabel) dashaLabel.textContent = copy.dashaYear;
    for (const control of [nodeControl, styleControl]) {
      for (const option of control.options) option.textContent = copy[option.value];
    }
    for (const option of dashaControl.options) option.textContent = option.value === '365.25' ? copy.julianYear : copy.traditionalYear;
    caption();
  }
  function setStyle(next, { notify: shouldNotify = true } = {}) {
    if (!['north', 'south'].includes(next)) throw new Error(COPY[language].styleError);
    const changed = styleControl.value !== next;
    styleControl.value = next;
    caption();
    if (changed && shouldNotify) notify('display');
  }
  nodeControl.addEventListener('change', () => notify('calculation'));
  dashaControl.addEventListener('change', () => notify('calculation'));
  styleControl.addEventListener('change', () => notify('display'));
  const api = { value, style, updateLanguage, setStyle };
  mounted.set(root, api);
  updateLanguage(language);
  return api;
}
