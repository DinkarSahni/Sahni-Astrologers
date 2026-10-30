import { initializePlacePicker } from '/chart-location.js';
import { initializeChartOptions } from '/chart-options.js';
import { renderDivisionExplorer, renderSolarDetails, renderPanchangTransitions, renderDashaTree } from '/chart-extras-view.js';
import { createChartRecord, downloadChartRecord } from '/chart-record.js';

const SIGN_HI = ['मेष', 'वृषभ', 'मिथुन', 'कर्क', 'सिंह', 'कन्या', 'तुला', 'वृश्चिक', 'धनु', 'मकर', 'कुंभ', 'मीन'];
const SIGN_EN = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const PLANET_HI = { Sun: 'सूर्य', Moon: 'चन्द्र', Mars: 'मंगल', Mercury: 'बुध', Jupiter: 'गुरु', Venus: 'शुक्र', Saturn: 'शनि', Rahu: 'राहु', Ketu: 'केतु' };
const NAK_EN = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
const NAK_HI = ['अश्विनी', 'भरणी', 'कृत्तिका', 'रोहिणी', 'मृगशिरा', 'आर्द्रा', 'पुनर्वसु', 'पुष्य', 'आश्लेषा', 'मघा', 'पूर्व फाल्गुनी', 'उत्तर फाल्गुनी', 'हस्त', 'चित्रा', 'स्वाती', 'विशाखा', 'अनुराधा', 'ज्येष्ठा', 'मूल', 'पूर्व आषाढ़ा', 'उत्तर आषाढ़ा', 'श्रवण', 'धनिष्ठा', 'शतभिषा', 'पूर्व भाद्रपदा', 'उत्तर भाद्रपदा', 'रेवती'];
const CITY_HI = { jalandhar: 'जालंधर', ludhiana: 'लुधियाना', amritsar: 'अमृतसर', chandigarh: 'चंडीगढ़', patiala: 'पटियाला', bathinda: 'बठिंडा', pathankot: 'पठानकोट', mohali: 'मोहाली', phagwara: 'फगवाड़ा', kapurthala: 'कपूरथला', hoshiarpur: 'होशियारपुर', delhi: 'नई दिल्ली', mumbai: 'मुंबई', kolkata: 'कोलकाता', chennai: 'चेन्नई', bengaluru: 'बेंगलुरु', hyderabad: 'हैदराबाद', pune: 'पुणे', ahmedabad: 'अहमदाबाद', surat: 'सूरत', jaipur: 'जयपुर', lucknow: 'लखनऊ', kanpur: 'कानपुर', agra: 'आगरा', varanasi: 'वाराणसी', patna: 'पटना', bhopal: 'भोपाल', indore: 'इंदौर', nagpur: 'नागपुर', kochi: 'कोच्चि', thiruvananthapuram: 'तिरुवनंतपुरम', bhubaneswar: 'भुवनेश्वर', guwahati: 'गुवाहाटी', shimla: 'शिमला', dehradun: 'देहरादून', jammu: 'जम्मू', srinagar: 'श्रीनगर', london: 'लंदन', 'new-york': 'न्यूयॉर्क', toronto: 'टोरंटो', sydney: 'सिडनी', dubai: 'दुबई', singapore: 'सिंगापुर' };
const PANCHANG_HI = {
  Pratipada: 'प्रतिपदा', Dvitiya: 'द्वितीया', Tritiya: 'तृतीया', Chaturthi: 'चतुर्थी', Panchami: 'पंचमी', Shashthi: 'षष्ठी', Saptami: 'सप्तमी', Ashtami: 'अष्टमी', Navami: 'नवमी', Dashami: 'दशमी', Ekadashi: 'एकादशी', Dvadashi: 'द्वादशी', Trayodashi: 'त्रयोदशी', Chaturdashi: 'चतुर्दशी', Purnima: 'पूर्णिमा', Amavasya: 'अमावस्या', Shukla: 'शुक्ल', Krishna: 'कृष्ण',
  Vishkambha: 'विष्कम्भ', Priti: 'प्रीति', Ayushman: 'आयुष्मान', Saubhagya: 'सौभाग्य', Shobhana: 'शोभन', Atiganda: 'अतिगण्ड', Sukarma: 'सुकर्मा', Dhriti: 'धृति', Shula: 'शूल', Ganda: 'गण्ड', Vriddhi: 'वृद्धि', Dhruva: 'ध्रुव', Vyaghata: 'व्याघात', Harshana: 'हर्षण', Vajra: 'वज्र', Siddhi: 'सिद्धि', Vyatipata: 'व्यतीपात', Variyana: 'वरीयान', Parigha: 'परिघ', Shiva: 'शिव', Siddha: 'सिद्ध', Sadhya: 'साध्य', Shubha: 'शुभ', Brahma: 'ब्रह्म', Indra: 'इन्द्र', Vaidhriti: 'वैधृति',
  Kimstughna: 'किंस्तुघ्न', Bava: 'बव', Balava: 'बालव', Kaulava: 'कौलव', Taitila: 'तैतिल', Gara: 'गर', Vanija: 'वणिज', Vishti: 'विष्टि', Shakuni: 'शकुनि', Chatushpada: 'चतुष्पाद', Naga: 'नाग',
  Sunday: 'रविवार', Monday: 'सोमवार', Tuesday: 'मंगलवार', Wednesday: 'बुधवार', Thursday: 'गुरुवार', Friday: 'शुक्रवार', Saturday: 'शनिवार',
};
const COPY = {
  en: {
    eyebrow: 'Free · Calculated on your device', heading: 'Your birth chart.', subheading: 'A place to begin.',
    intro: 'Find your birth place across India and prepare a sidereal Kundali in English or Hindi. Your birth details stay on this device unless you choose to share them.',
    scope: '16 divisional charts, planetary placements, sunrise and Panchang timings, and three levels of Vimshottari periods. Calculated privately on your device.',
    formEyebrow: 'Your personal chart', formTitle: 'Begin with the details.', detailsTitle: 'Birth details', placeTitle: 'Birth place', placeModes: 'Choose how to enter your birth place', timeHelp: 'Use the local time on your birth record. Seconds are optional; do not guess an unknown birth time.',
    name: 'Your name (optional)', city: 'City of birth', date: 'Date of birth', time: 'Local time of birth', chooseCity: 'Choose your actual birth city',
    locationHelp: 'Choose the actual birth city. If it is not listed, contact us rather than selecting a nearby city. An uncertain birth time can change the ascendant.',
    calculate: 'Calculate birth chart →', preparing: 'Preparing your chart…', calculated: 'Your calculated chart', resultTitle: 'Your birth chart', namedTitle: name => `${name}’s birth chart`,
    language: 'Chart language', local: 'local', settings: 'Settings', sidereal: 'Sidereal', lahiri: 'Lahiri approximation', node: 'Mean lunar node', houses: 'Whole sign', dashaYear: 'Dasha year', days: 'days', utc: 'UTC birth time',
    ascendant: 'Ascendant / Lagna', moonSign: 'Moon sign', nakshatra: 'Nakshatra', pada: 'Pada', lord: 'Nakshatra lord', d1: 'Birth chart · D1', d9: 'Navamsa · D9',
    svgD1: 'North Indian whole-sign D1 birth chart. Placements are also in the planet table.', svgD9: 'North Indian Navamsa D9 chart. Placements are also in the planet table.',
    diagramHelp: 'Numbers 1–12 identify zodiac signs, starting with Aries. H identifies the house. Su Sun · Mo Moon · Me Mercury · Ve Venus · Ma Mars · Ju Jupiter · Sa Saturn · Ra Rahu · Ke Ketu · ℞ retrograde.',
    placements: 'Planetary placements', columns: ['Planet', 'Sidereal sign', 'Degree', 'House', 'Nakshatra', 'Pada', 'D9 sign', 'Motion'], direct: 'Direct', retrograde: 'Retrograde',
    periods: 'Vimshottari periods', periodHelp: 'The first period starts with the balance remaining at birth. Dates below are displayed in IST. Expand a major period to see its sub-periods.', current: 'current', subColumns: ['Sub-period', 'From · IST', 'Until · IST'],
    panchang: 'Panchang at birth', panchangHelp: 'Lunar factors are calculated at the birth instant. The weekday follows the local civil date; it is not a sunrise-based Vara or a daily Panchang.', panchangLabels: ['Tithi · Paksha', 'Yoga', 'Karana', 'Civil weekday'], manualCoordinates: 'Coordinates entered by you', placeCoordinates: 'Listed place-centre coordinates',
    historicTime: 'Historical birth record: this chart uses Asia/Kolkata civil-time history. Earlier local conventions, including Bombay/Calcutta time and wartime changes, varied. Have the original time convention checked before using this chart professionally.',
    loadError: 'The chart could not load. Please reload this page and try again, or contact us for help.',
    trueNode: 'True node · osculating approximation', uncertainMotion: 'Near station · uncertain', export: 'Download chart record', exportStarted: 'Chart download started. The JSON file contains your birth details and the calculation settings; keep it private.', exportEmbedded: 'Open the downloaded website in a full browser to download a chart record. Nothing has been downloaded from this viewer.', exportError: 'The chart record could not be created. Please calculate the chart again.',
    notes: 'Calculation notes', warnings: [
      'Uses the displayed coordinates and an approximate Lahiri ayanamsa. Small differences near sign, nakshatra or D9 boundaries can change the result.',
      'Rahu and Ketu use the mean node, not the true node. Choose matching settings when comparing another chart.',
      'For a professional reading, have Sahni Astrologers check the birth record and chart. Results describe traditional astrological classifications, not scientific predictions.',
      'A chart calculation is a starting point. Please have professional-use charts and uncertain birth details checked by the practice.',
    ],
    print: 'Print / save as PDF', printHelp: 'If this preview cannot open the print dialog, open the downloaded website in your browser to print or save a PDF.', book: 'Book a personal reading →', privacy: 'Your birth details have not been sent to the server. They are not automatically copied into the booking form.',
    share: 'Choose to share these details on WhatsApp →', shareHelp: 'Only open this draft if you want to share the displayed name, birth details, and Lagna with Sahni Astrologers. Nothing is sent automatically; you still need to tap Send in WhatsApp.',
    error: 'We could not calculate this chart. Please check the birth date, time, and supported city, or contact us for help.',
  },
  hi: {
    eyebrow: 'निःशुल्क · आपके डिवाइस पर गणना', heading: 'आपकी जन्म कुंडली।', subheading: 'एक शुरुआत।',
    intro: 'भारत भर में अपना जन्म स्थान खोजें और अंग्रेज़ी या हिन्दी में निरयन जन्म कुंडली बनाएँ। जब तक आप साझा न करें, आपके जन्म विवरण इसी डिवाइस पर रहते हैं।',
    scope: '१६ वर्ग कुंडलियाँ, ग्रहों की स्थिति, सूर्योदय और पंचांग के समय, तथा विंशोत्तरी दशा के तीन स्तर। गणना निजी रूप से आपके डिवाइस पर होती है।',
    formEyebrow: 'आपकी व्यक्तिगत कुंडली', formTitle: 'सही विवरण से शुरुआत।', detailsTitle: 'जन्म विवरण', placeTitle: 'जन्म स्थान', placeModes: 'जन्म स्थान दर्ज करने का तरीका चुनें', timeHelp: 'जन्म रिकॉर्ड में दिया स्थानीय समय भरें। सेकंड वैकल्पिक हैं; अज्ञात जन्म समय का अनुमान न लगाएँ।',
    name: 'आपका नाम (वैकल्पिक)', city: 'जन्म का शहर', date: 'जन्म की तारीख', time: 'जन्म का स्थानीय समय', chooseCity: 'अपना वास्तविक जन्म शहर चुनें',
    locationHelp: 'वास्तविक जन्म शहर चुनें। शहर सूची में न हो तो पास का शहर चुनने के बजाय हमसे संपर्क करें। जन्म समय की अनिश्चितता से लग्न बदल सकता है।',
    calculate: 'जन्म कुंडली बनाएँ →', preparing: 'आपकी कुंडली तैयार हो रही है…', calculated: 'आपकी गणना की गई कुंडली', resultTitle: 'आपकी जन्म कुंडली', namedTitle: name => `${name} की जन्म कुंडली`,
    language: 'कुंडली की भाषा', local: 'स्थानीय समय', settings: 'गणना पद्धति', sidereal: 'निरयन राशि चक्र', lahiri: 'लाहिड़ी अयनांश का सन्निकटन', node: 'मध्यम चन्द्र नोड', houses: 'पूर्ण राशि भाव', dashaYear: 'दशा वर्ष', days: 'दिन', utc: 'जन्म का UTC समय',
    ascendant: 'लग्न', moonSign: 'चन्द्र राशि', nakshatra: 'जन्म नक्षत्र', pada: 'पद', lord: 'नक्षत्र स्वामी', d1: 'जन्म कुंडली · D1', d9: 'नवांश कुंडली · D9',
    svgD1: 'उत्तर भारतीय पूर्ण राशि भाव की जन्म कुंडली D1। ग्रहों की स्थिति नीचे तालिका में भी दी गई है।', svgD9: 'उत्तर भारतीय नवांश कुंडली D9। ग्रहों की स्थिति नीचे तालिका में भी दी गई है।',
    diagramHelp: '१–१२ अंक मेष से मीन तक राशियाँ दर्शाते हैं। भा भाव है। सू सूर्य · चं चन्द्र · बु बुध · शु शुक्र · मं मंगल · गु गुरु · श शनि · रा राहु · के केतु · ℞ वक्री।',
    placements: 'ग्रहों की स्थिति', columns: ['ग्रह', 'निरयन राशि', 'अंश', 'भाव', 'नक्षत्र', 'पद', 'नवांश राशि', 'गति'], direct: 'मार्गी', retrograde: 'वक्री',
    periods: 'विंशोत्तरी दशा', periodHelp: 'पहली अवधि जन्म के समय शेष दशा से शुरू होती है। नीचे की तारीखें भारतीय मानक समय (IST) में हैं। अंतर्दशाएँ देखने के लिए महादशा खोलें।', current: 'वर्तमान', subColumns: ['अंतर्दशा', 'शुरू · IST', 'समाप्त · IST'],
    panchang: 'जन्म के क्षण का पंचांग', panchangHelp: 'चन्द्र संबंधी गणनाएँ जन्म के क्षण की हैं। वार स्थानीय नागरिक तारीख के अनुसार है; यह सूर्योदय पर आधारित वार या दैनिक पंचांग नहीं है।', panchangLabels: ['तिथि · पक्ष', 'योग', 'करण', 'नागरिक वार'], manualCoordinates: 'आपके भरे हुए निर्देशांक', placeCoordinates: 'सूची में दिए स्थान के केंद्र के निर्देशांक',
    historicTime: 'पुराना जन्म रिकॉर्ड: यह कुंडली Asia/Kolkata के नागरिक समय इतिहास पर आधारित है। पहले स्थानीय समय पद्धतियाँ, जैसे बम्बई/कलकत्ता समय और युद्धकालीन बदलाव, अलग हो सकती थीं। पेशेवर उपयोग से पहले जन्म रिकॉर्ड की मूल समय पद्धति की जाँच कराएँ।',
    loadError: 'कुंडली का साधन नहीं खुल सका। कृपया पेज रीलोड करके फिर प्रयास करें, या सहायता के लिए हमसे संपर्क करें।',
    trueNode: 'वास्तविक नोड · कक्षीय सन्निकटन', uncertainMotion: 'स्थिर अवस्था के पास · अनिश्चित', export: 'कुंडली रिकॉर्ड डाउनलोड करें', exportStarted: 'कुंडली का डाउनलोड शुरू हुआ। JSON फ़ाइल में जन्म विवरण और गणना की पद्धति है; इसे निजी रखें।', exportEmbedded: 'कुंडली रिकॉर्ड डाउनलोड करने के लिए डाउनलोड की गई वेबसाइट पूरे ब्राउज़र में खोलें। इस प्रीव्यू से कोई फ़ाइल डाउनलोड नहीं हुई है।', exportError: 'कुंडली रिकॉर्ड नहीं बन सका। कृपया कुंडली की गणना फिर करें।',
    notes: 'गणना संबंधी जानकारी', warnings: [
      'दिखाए गए निर्देशांक और लाहिड़ी अयनांश का सन्निकटन उपयोग किया गया है। राशि, नक्षत्र या नवांश की सीमा के पास छोटा अंतर भी परिणाम बदल सकता है।',
      'राहु और केतु के लिए मध्यम नोड का उपयोग होता है, वास्तविक नोड का नहीं। दूसरी कुंडली से तुलना करते समय समान पद्धति चुनें।',
      'व्यक्तिगत परामर्श के लिए Sahni Astrologers से जन्म विवरण और कुंडली की जाँच कराएँ। ये पारंपरिक ज्योतिषीय वर्गीकरण हैं, वैज्ञानिक भविष्यवाणियाँ नहीं।',
      'यह गणना व्यक्तिगत परामर्श का विकल्प नहीं है। पेशेवर उपयोग से पहले, विशेषकर राशि या नक्षत्र की सीमा के पास, कुंडली की जाँच कराएँ।',
    ],
    print: 'प्रिंट करें / PDF सहेजें', printHelp: 'यदि इस प्रीव्यू में प्रिंट विंडो न खुले, तो डाउनलोड की गई वेबसाइट अपने ब्राउज़र में खोलकर प्रिंट करें या PDF सहेजें।', book: 'व्यक्तिगत परामर्श बुक करें →', privacy: 'आपके जन्म विवरण सर्वर पर नहीं भेजे गए हैं। वे अपने आप बुकिंग फ़ॉर्म में नहीं भरे जाते।',
    share: 'इन विवरणों को WhatsApp पर साझा करने का विकल्प →', shareHelp: 'दिखाए गए नाम, जन्म विवरण और लग्न को Sahni Astrologers से साझा करना चाहें तभी यह ड्राफ्ट खोलें। कोई संदेश अपने आप नहीं भेजा जाता; WhatsApp में Send दबाना आवश्यक है।',
    error: 'कुंडली की गणना नहीं हो सकी। जन्म की तारीख, समय और सूची में दिया शहर जाँचें, या सहायता के लिए हमसे संपर्क करें।',
  },
};

const $ = selector => document.querySelector(selector);
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}
const locale = language => language === 'hi' ? 'hi-IN-u-nu-deva' : 'en-IN';
const number = (value, language, options = {}) => new Intl.NumberFormat(locale(language), { useGrouping: false, ...options }).format(value);
const signName = (value, language) => language === 'hi' ? SIGN_HI[SIGN_EN.indexOf(value)] || value : value;
const planetName = (value, language) => language === 'hi' ? PLANET_HI[value] || value : value;
const nakshatraName = (value, language) => language === 'hi' ? NAK_HI[NAK_EN.indexOf(value)] || value : value;
const cityName = (city, language) => language === 'hi' && CITY_HI[city.id]
  ? `${CITY_HI[city.id]}${city.region ? `, ${city.region}` : ''} · ${city.timeZone}` : city.name;
const formatDate = (value, language) => new Intl.DateTimeFormat(locale(language), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(value));
const formatDegree = (value, language) => {
  const seconds = Math.floor(value * 3600);
  return `${number(Math.floor(seconds / 3600), language)}° ${number(Math.floor(seconds / 60) % 60, language, { minimumIntegerDigits: 2 })}′ ${number(seconds % 60, language, { minimumIntegerDigits: 2 })}″`;
};
function makeTable(headings, rows) {
  const wrap = node('div', undefined, 'table-wrap'); wrap.tabIndex = 0;
  const table = node('table'), head = node('thead'), headingRow = node('tr'), body = node('tbody');
  headings.forEach(text => { const th = node('th', text); th.scope = 'col'; headingRow.append(th); });
  head.append(headingRow);
  rows.forEach(values => { const row = node('tr'); values.forEach(value => row.append(node('td', value))); body.append(row); });
  table.append(head, body); wrap.append(table); return wrap;
}


function localizeError(error, language) {
  if (error instanceof TypeError || error.code === 'PLACE_DIRECTORY_UNAVAILABLE') return COPY[language].loadError;
  if (language === 'en') return error.message || COPY.en.error;
  const message = error.message || '';
  if (message.includes('occurred twice')) return 'घड़ी बदलने के कारण यह स्थानीय समय दो बार आया था। गणना से पहले जन्म समय की पुष्टि के लिए हमसे संपर्क करें।';
  if (message.includes('did not exist')) return 'घड़ी बदलने के कारण यह स्थानीय समय मौजूद नहीं था। कृपया जन्म रिकॉर्ड जाँचें।';
  if (message.includes('supported birth city')) return 'सूची में दिया वास्तविक जन्म शहर चुनें। किसी दूसरे शहर को अपने आप नहीं चुना जाता।';
  if (message.includes('calendar date does not exist')) return 'कैलेंडर में यह तारीख मौजूद नहीं है। कृपया तारीख जाँचें।';
  if (message.includes('1900 and 2100')) return '१९०० से २१०० के बीच मान्य तारीख और २४ घंटे के प्रारूप में समय दर्ज करें।';
  if (message.includes('latitude 6')) return 'भारत में जन्म के लिए अक्षांश ६–३८° उत्तर और देशांतर ६८–९८° पूर्व भरें।';
  if (message.includes('birth-place name')) return 'जन्म स्थान का नाम २ से १६० अक्षरों में भरें।';
  return COPY.hi.error;
}

/** Mount once; language switches render the same cached numerical chart. */
export function initChartView({ navigationHref = path => path } = {}) {
  const form = $('#chart-form');
  if (!form || form.dataset.chartInitialized) return;
  form.dataset.chartInitialized = 'true';
  const languageSelect = $('#chart-language');
  let language = languageSelect?.value === 'hi' ? 'hi' : 'en';
  let cached = null;
  let calculating = false;
  let selectedDivision = 'D9';
  const target = $('#chart-result');
  const placePicker = initializePlacePicker({ language, cityLabel: cityName });
  const chartOptions = initializeChartOptions({ language, onChange: change => {
    if (change.kind === 'display') { if (cached) renderChart(cached.chart, cached.name, { focus: false }); }
    else { cached = null; target.hidden = true; $('#chart-error').textContent = ''; }
  } });
  const currentInput = () => ({ date: $('#chart-date').value, time: $('#chart-time').value, ...placePicker.value(), settings: chartOptions.value() });
  const fingerprint = () => JSON.stringify({ ...currentInput(), name: $('#chart-name').value.trim() });

  function updateForm() {
    const copy = COPY[language];
    form.lang = language;
    form.setAttribute('aria-busy', String(calculating));
    if (languageSelect) languageSelect.value = language;
    for (const [id, key] of [['chart-name','name'],['chart-date','date'],['chart-time','time']]) {
      const label = document.querySelector(`label[for="${id}"]`); if (label) label.textContent = copy[key];
    }
    const page = $('#page-birth-chart');
    const eyebrow = page?.querySelector(':scope > .eyebrow'); if (eyebrow) { eyebrow.textContent = copy.eyebrow; eyebrow.lang = language; }
    const heading = page?.querySelector(':scope > h1'); if (heading) { heading.replaceChildren(document.createTextNode(copy.heading), node('br'), node('em', copy.subheading)); heading.lang = language; }
    for (const [id, key] of [['chart-intro','intro'],['chart-scope-note','scope'],['chart-time-help','timeHelp'],['chart-form-eyebrow','formEyebrow'],['chart-form-title','formTitle']]) {
      const element = $(`#${id}`); if (element) { element.textContent = copy[key]; element.lang = language; }
    }
    for (const [id, index, key] of [['chart-birth-details-title','01','detailsTitle'],['chart-birth-place-title','02','placeTitle']]) {
      const title = $(`#${id}`); if (title) title.replaceChildren(node('span', number(Number(index), language, { minimumIntegerDigits: 2 })), document.createTextNode(` ${copy[key]}`));
    }
    $('#chart-place-modes').setAttribute('aria-label', copy.placeModes);
    placePicker.updateLanguage(language);
    chartOptions.updateLanguage(language);
    $('#chart-submit').textContent = calculating ? copy.preparing : copy.calculate;
  }

  function setLanguage(next, { focusButton = false } = {}) {
    language = next === 'hi' ? 'hi' : 'en';
    updateForm();
    if (cached) {
      renderChart(cached.chart, cached.name, { focus: false });
      if (focusButton) target.querySelector(`[data-chart-language="${language}"]`)?.focus({ preventScroll: true });
    }
  }

  function renderChart(chart, name, { focus = true } = {}) {
    const copy = COPY[language];
    target.lang = language;
    target.dataset.chartLanguage = language;
    target.dataset.calculationUtc = chart.utc;
    target.dataset.birthPlaceId = chart.city.id;
    target.replaceChildren(node('p', copy.calculated, 'eyebrow'), node('h2', name ? copy.namedTitle(name) : copy.resultTitle), node('p', `${formatDate(`${chart.date}T12:00:00Z`, language)} · ${chart.time.split(':').map(part => number(Number(part), language, { minimumIntegerDigits: 2 })).join(':')} ${copy.local} · ${cityName(chart.city, language)}`, 'lead'));
    const languageGroup = node('div', undefined, 'button-row chart-language-controls'); languageGroup.setAttribute('role', 'group'); languageGroup.setAttribute('aria-label', copy.language);
    for (const [id, text] of [['en','English'],['hi','हिन्दी']]) {
      const button = node('button', text, 'button button-outline'); button.type = 'button'; button.lang = id; button.dataset.chartLanguage = id; button.setAttribute('aria-pressed', String(language === id)); button.addEventListener('click', () => setLanguage(id, { focusButton: true })); languageGroup.append(button);
    }
    target.append(languageGroup);
    target.append(node('p', `${copy.settings}: ${chart.settings.engine} · ${copy.sidereal} · ${copy.lahiri} (${number(chart.ayanamsa, language, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}°) · ${chart.settings.nodeMode === 'true' ? copy.trueNode : copy.node} · ${copy.houses} · ${copy.dashaYear} ${number(chart.settings.dashaYearDays, language)} ${copy.days}.`, 'chart-settings'));
    target.append(node('p', `${chart.city.source === 'manual' ? copy.manualCoordinates : copy.placeCoordinates} · ${number(chart.city.lat, language, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}°, ${number(chart.city.lon, language, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}° · ${chart.city.timeZone} · ${copy.utc} ${chart.utc}`, 'fineprint'));
    if (chart.city.timeZone === 'Asia/Kolkata' && chart.date < '1956-01-01') target.append(node('p', copy.historicTime, 'notice'));
    const summary = node('dl', undefined, 'chart-summary');
    [[copy.ascendant, signName(chart.ascendant.sign, language)], [copy.moonSign, signName(chart.moonSign, language)], [copy.nakshatra, `${nakshatraName(chart.nakshatra, language)} · ${copy.pada} ${number(chart.nakshatraPada, language)}`], [copy.lord, planetName(chart.nakshatraLord, language)]].forEach(([label,value]) => { const pair = node('div'); pair.append(node('dt', label), node('dd', value)); summary.append(pair); });
    target.append(summary);
    if (chart.panchang) {
      const panchang = node('section', undefined, 'chart-panchang');
      panchang.append(node('h3', copy.panchang), node('p', copy.panchangHelp, 'fineprint'));
      const values = node('dl', undefined, 'panchang-grid');
      const translated = value => language === 'hi' ? PANCHANG_HI[value] || value : value;
      const lunar = chart.panchang;
      [
        `${translated(lunar.tithi.name)} · ${translated(lunar.tithi.paksha)}`,
        translated(lunar.yoga.name), translated(lunar.karana.name), translated(lunar.weekday.name),
      ].forEach((value, index) => { const pair = node('div'); pair.append(node('dt', copy.panchangLabels[index]), node('dd', value)); values.append(pair); });
      panchang.append(values); target.append(panchang);
    }
    const explorer = renderDivisionExplorer(chart, { language, style: chartOptions.style(), selectedDivision, onStyleChange: style => chartOptions.setStyle(style, { notify: false }), onDivisionChange: id => { selectedDivision = id; } });
    target.append(explorer.section);
    target.append(node('h3', copy.placements), makeTable(copy.columns, chart.planets.map(p => [planetName(p.name, language), signName(p.sign, language), formatDegree(p.degree, language), number(p.house, language), nakshatraName(p.nakshatra, language), number(p.pada, language), signName(p.navamsaSign, language), p.motionUncertain ? copy.uncertainMotion : p.retrograde ? copy.retrograde : copy.direct])));
    target.append(explorer.placements, renderSolarDetails(chart, language), renderPanchangTransitions(chart, language), renderDashaTree(chart, language));
    const notes = node('div', undefined, 'notice'), list = node('ul'); notes.append(node('strong', copy.notes));
    copy.warnings.forEach((warning, index) => { if (index !== 1 || chart.settings.nodeMode === 'mean') list.append(node('li', warning)); });
    if (chart.settings.nodeMode === 'true') list.append(node('li', language === 'hi' ? 'वास्तविक नोड कक्षीय सन्निकटन है। स्थिति का अंतर लगभग एक आर्कमिनट तक हो सकता है; स्थिर अवस्था के पास गति अनिश्चित चिह्नित है।' : 'The osculating true-node option is approximate. Position differences can approach one arcminute; motion near a station is marked uncertain.'));
    notes.append(list); target.append(notes);
    const buttons = node('div', undefined, 'button-row'), print = node('button', copy.print, 'button button-outline'); print.type = 'button'; print.id = 'chart-print';
    print.addEventListener('click', () => { const previous = document.title; document.title = `Sahni Astrologers — ${name ? copy.namedTitle(name) : copy.resultTitle}`; try { window.print(); } finally { document.title = previous; } });
    const booking = node('a', copy.book, 'button'); booking.href = navigationHref('/booking?service=kundali'); booking.dataset.nav = ''; buttons.append(print, booking); target.append(buttons, node('p', copy.privacy, 'fineprint'));
    const exportButton = node('button', copy.export, 'button button-outline'), exportStatus = node('p', undefined, 'fineprint');
    exportButton.type = 'button'; exportButton.id = 'chart-export'; exportStatus.id = 'chart-export-status'; exportStatus.setAttribute('role', 'status');
    exportButton.addEventListener('click', () => {
      try {
        const record = createChartRecord({ chart, name, language, style: chartOptions.style(), selectedDivision });
        const result = downloadChartRecord(record);
        exportStatus.textContent = result.downloaded ? copy.exportStarted : copy.exportEmbedded;
      } catch { exportStatus.textContent = copy.exportError; }
    });
    buttons.append(exportButton); target.append(exportStatus);
    if (window.self !== window.top) target.append(node('p', copy.printHelp, 'fineprint'));
    const share = node('a', copy.share, 'text-link'); share.id = 'chart-whatsapp'; share.target = '_blank'; share.rel = 'noopener noreferrer';
    const message = language === 'hi'
      ? `नमस्ते Sahni Astrologers, मैं कुंडली पर व्यक्तिगत परामर्श चाहता/चाहती हूँ।\n\nनाम: ${name || '—'}\nजन्म तारीख: ${chart.date}\nस्थानीय जन्म समय: ${chart.time}\nजन्म स्थान: ${chart.city.name}\nनिर्देशांक: ${chart.city.lat}, ${chart.city.lon}\nसमय क्षेत्र: ${chart.city.timeZone}\nलग्न: ${signName(chart.ascendant.sign, language)}\n\nकृपया उपलब्ध समय बताएँ।`
      : `Hello Sahni Astrologers, I would like a personal birth-chart consultation.\n\nName: ${name || '—'}\nBirth date: ${chart.date}\nLocal birth time: ${chart.time}\nBirth place: ${chart.city.name}\nCoordinates: ${chart.city.lat}, ${chart.city.lon}\nTime zone: ${chart.city.timeZone}\nLagna: ${chart.ascendant.sign}\n\nPlease let me know your availability.`;
    share.href = `https://wa.me/919465245577?text=${encodeURIComponent(message)}`; target.append(share, node('p', copy.shareHelp, 'fineprint'));
    target.hidden = false;
    if (focus) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }

  languageSelect?.addEventListener('change', () => setLanguage(languageSelect.value));
  async function calculate(event) {
    event.preventDefault();
    if (calculating) return;
    $('#chart-error').textContent = '';
    calculating = true; $('#chart-submit').disabled = true;
    form.setAttribute('aria-busy', 'true');
    $('#chart-submit').textContent = COPY[language].preparing;
    try {
      await placePicker.prepare();
      if (!form.reportValidity()) return;
      const { calculateChart } = await import('/chart-engine.js');
      // Fields remain editable while the numerical module loads. Read the
      // current values after loading so an earlier edit cannot render stale data.
      await placePicker.prepare();
      if (!form.reportValidity()) return;
      const input = currentInput(), name = $('#chart-name').value.trim();
      cached = { chart: calculateChart(input), name, fingerprint: fingerprint() };
      renderChart(cached.chart, cached.name);
    } catch (error) { $('#chart-error').textContent = localizeError(error, language); target.hidden = true; cached = null; }
    finally { calculating = false; $('#chart-submit').disabled = false; updateForm(); }
  }
  // Local calculations must also work in previews that allow scripts but block
  // native form submission. Keep submission and keyboard support for browsers.
  $('#chart-submit').addEventListener('click', calculate);
  form.addEventListener('submit', calculate);
  form.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.isComposing && event.target.tagName === 'INPUT') {
      if (event.target.id === 'chart-place-search') { event.preventDefault(); $('#chart-city').focus(); }
      else calculate(event);
    }
  });
  const invalidate = event => {
    if (event.target.id === 'chart-language' || !cached || cached.fingerprint === fingerprint()) return;
    cached = null; target.hidden = true; $('#chart-error').textContent = '';
  };
  form.addEventListener('input', invalidate);
  form.addEventListener('change', invalidate);
  for (const id of ['chart-mode-search', 'chart-mode-coordinates']) $(`#${id}`).addEventListener('click', invalidate);
  updateForm();
}
