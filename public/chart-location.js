const COPY = {
  en: {
    searchMode: 'Find a place', coordinatesMode: 'Exact coordinates', search: 'Search your birth place',
    placeholder: 'Town, city, district or state…', region: 'State / union territory', allRegions: 'All India + selected overseas cities',
    city: 'City of birth', choose: 'Choose the matching birth place', customPlace: 'Birth place name', latitude: 'Latitude · north', longitude: 'Longitude · east',
    customHelp: 'For a village, hospital or place outside the list, enter verified coordinates from your birth record or a trusted map. Use decimal degrees, north and east positive. Indian civil time is applied for the birth date.',
    locationHelp: 'Select your actual birth place and check the state and coordinates. Listed coordinates mark the place centre; use exact coordinates when you know them. A nearby city or an uncertain time can change the Lagna.',
    loading: 'Loading the offline place directory…', failed: 'The place directory could not load. Reload this page to try again, or contact us for help.',
    available: count => `${count.toLocaleString('en-IN')} Indian places across all 36 states and union territories. Search to find yours.`,
    found: count => `${count} matching ${count === 1 ? 'place' : 'places'} shown. Choose one below.`,
    capped: 'Showing the first 60 matches. Add a district or choose a state to narrow the list.',
    empty: 'No matching place in the offline directory. Try another spelling, or enter exact coordinates for a birth in India.',
    selected: 'Selected birth place', manual: 'Exact coordinates entered by you', centre: 'Place-centre coordinates',
    timezone: 'Civil time zone', attribution: 'Place directory: GeoNames · CC BY 4.0',
  },
  hi: {
    searchMode: 'जन्म स्थान खोजें', coordinatesMode: 'सटीक निर्देशांक', search: 'अपना जन्म स्थान खोजें',
    placeholder: 'शहर, कस्बा, ज़िला या राज्य…', region: 'राज्य / केंद्र शासित प्रदेश', allRegions: 'पूरा भारत + चुनिंदा विदेशी शहर',
    city: 'जन्म का शहर', choose: 'मिलता हुआ वास्तविक जन्म स्थान चुनें', customPlace: 'जन्म स्थान का नाम', latitude: 'अक्षांश · उत्तर', longitude: 'देशांतर · पूर्व',
    customHelp: 'गाँव, अस्पताल या सूची से बाहर के भारतीय स्थान के लिए जन्म रिकॉर्ड या विश्वसनीय मानचित्र से सत्यापित निर्देशांक भरें। दशमलव अंश में उत्तर और पूर्व धनात्मक रखें। जन्म तारीख के अनुसार भारतीय नागरिक समय उपयोग होगा।',
    locationHelp: 'वास्तविक जन्म स्थान चुनें और राज्य व निर्देशांक जाँचें। सूची के निर्देशांक स्थान के केंद्र के हैं; सटीक निर्देशांक हों तो उनका उपयोग करें। पास का शहर या अनिश्चित जन्म समय लग्न बदल सकता है।',
    loading: 'ऑफ़लाइन स्थान सूची खुल रही है…', failed: 'स्थान सूची नहीं खुल सकी। दोबारा खोलने के लिए पेज रीलोड करें, या सहायता के लिए हमसे संपर्क करें।',
    available: count => `सभी ३६ राज्यों और केंद्र शासित प्रदेशों के ${count.toLocaleString('hi-IN')} भारतीय स्थान। अपना स्थान खोजें।`,
    found: count => `${count.toLocaleString('hi-IN')} मिलते हुए स्थान दिखाए गए हैं। नीचे सही स्थान चुनें।`,
    capped: 'पहले ६० परिणाम दिखाए गए हैं। ज़िला जोड़ें या राज्य चुनकर खोज सीमित करें।',
    empty: 'ऑफ़लाइन सूची में स्थान नहीं मिला। दूसरी वर्तनी खोजें, या भारत में जन्म के लिए सटीक निर्देशांक भरें।',
    selected: 'चुना हुआ जन्म स्थान', manual: 'आपके भरे हुए सटीक निर्देशांक', centre: 'स्थान के केंद्र के निर्देशांक',
    timezone: 'नागरिक समय क्षेत्र', attribution: 'स्थान सूची: GeoNames · CC BY 4.0',
  },
};
const $ = selector => document.querySelector(selector);
const text = (selector, value) => { const element = $(selector); if (element) element.textContent = value; };

/** Native search/results controls remain usable with keyboard and mobile pickers. */
export function initializePlacePicker({ language: initialLanguage = 'en', cityLabel = city => city.name } = {}) {
  let language = initialLanguage;
  let directory;
  let loading;
  let failed = false;
  let mode = 'search';
  const search = $('#chart-place-search');
  const region = $('#chart-region');
  const select = $('#chart-city');
  const status = $('#chart-place-status');
  const selected = $('#chart-selected-place');
  const customFields = [...$('#chart-coordinate-fields').querySelectorAll('input')];
  const format = value => new Intl.NumberFormat(language === 'hi' ? 'hi-IN' : 'en-IN', { useGrouping: false, minimumFractionDigits: 4, maximumFractionDigits: 5 }).format(value);
  const option = (value, label) => { const element = document.createElement('option'); element.value = value; element.textContent = label; return element; };

  function describeSelection() {
    const place = directory?.cities.find(city => city.id === select.value);
    selected.hidden = mode !== 'search' || !place;
    if (!place) { selected.replaceChildren(); return; }
    const copy = COPY[language];
    const title = document.createElement('strong'); title.textContent = `${copy.selected}: ${cityLabel(place, language)}`;
    const details = document.createElement('span'); details.textContent = `${copy.centre} · ${format(place.lat)}° N, ${format(place.lon)}° E · ${place.timeZone}`;
    // Overseas coordinates can be west/south; show signed values without a false compass label.
    if (place.lat < 0 || place.lon < 0) details.textContent = `${copy.centre} · ${format(place.lat)}°, ${format(place.lon)}° · ${place.timeZone}`;
    selected.replaceChildren(title, details);
  }

  function showMatches({ preserve = false } = {}) {
    if (!directory) return;
    const previous = preserve ? select.value : '';
    const query = search.value.trim();
    const matches = directory.searchCities(query, { limit: 60, state: region.value });
    // Retain an explicitly chosen place on translation, even outside the capped list.
    const priorPlace = preserve && directory.cities.find(city => city.id === previous);
    if (priorPlace && !matches.some(city => city.id === previous)) matches.unshift(priorPlace);
    select.replaceChildren(option('', COPY[language].choose), ...matches.map(place => option(place.id, cityLabel(place, language))));
    select.value = previous;
    const copy = COPY[language];
    status.textContent = query || region.value
      ? !matches.length ? copy.empty : matches.length >= 60 ? copy.capped : copy.found(matches.length)
      : copy.available(directory.placeCoverage.indiaPlaces);
    describeSelection();
  }

  function updateLanguage(next) {
    language = next === 'hi' ? 'hi' : 'en';
    const copy = COPY[language];
    for (const [id, key] of [['chart-mode-search', 'searchMode'], ['chart-mode-coordinates', 'coordinatesMode'], ['chart-location-help', 'locationHelp'], ['chart-coordinate-help', 'customHelp'], ['chart-place-attribution', 'attribution']]) text(`#${id}`, copy[key]);
    for (const [id, key] of [['chart-place-search', 'search'], ['chart-region', 'region'], ['chart-city', 'city'], ['chart-custom-place', 'customPlace'], ['chart-latitude', 'latitude'], ['chart-longitude', 'longitude']]) text(`label[for="${id}"]`, copy[key]);
    search.placeholder = copy.placeholder;
    const previousRegion = region.value;
    region.replaceChildren(option('', copy.allRegions), ...(directory?.indiaRegions || []).map(name => option(name, name)));
    region.value = previousRegion;
    if (directory) showMatches({ preserve: true });
    else { select.replaceChildren(option('', copy.choose)); status.textContent = failed ? copy.failed : copy.loading; }
  }

  async function activate() {
    if (directory) return directory;
    if (!loading) {
      failed = false;
      status.textContent = COPY[language].loading;
      loading = import('/chart-cities.js').then(result => {
        directory = result;
        updateLanguage(language);
        return directory;
      }).catch(() => {
        failed = true;
        status.textContent = COPY[language].failed;
        loading = undefined;
        const error = new Error(COPY[language].failed);
        error.code = 'PLACE_DIRECTORY_UNAVAILABLE';
        throw error;
      });
    }
    return loading;
  }

  function changeMode(next) {
    mode = next;
    const manual = mode === 'coordinates';
    $('#chart-city-fields').hidden = manual;
    $('#chart-coordinate-fields').hidden = !manual;
    [search, region, select].forEach(element => { element.disabled = manual; });
    select.required = !manual;
    customFields.forEach(element => { element.disabled = !manual; element.required = manual; });
    $('#chart-mode-search').setAttribute('aria-pressed', String(!manual));
    $('#chart-mode-coordinates').setAttribute('aria-pressed', String(manual));
    describeSelection();
    if (!manual) void activate().catch(() => {});
  }

  $('#chart-mode-search').addEventListener('click', () => changeMode('search'));
  $('#chart-mode-coordinates').addEventListener('click', () => changeMode('coordinates'));
  search.addEventListener('input', () => showMatches());
  region.addEventListener('change', () => showMatches());
  select.addEventListener('change', describeSelection);
  updateLanguage(language);
  customFields.forEach(element => { element.disabled = true; });
  window.addEventListener('sahni:route', event => {
    if (event.detail?.page === 'birth-chart') void activate().catch(() => {});
  });

  return {
    activate,
    updateLanguage,
    async prepare() { if (mode === 'search') await activate(); },
    value() {
      if (mode === 'search') return { cityId: select.value };
      return { location: { name: $('#chart-custom-place').value.trim(), lat: $('#chart-latitude').valueAsNumber, lon: $('#chart-longitude').valueAsNumber, timeZone: 'Asia/Kolkata' } };
    },
  };
}
