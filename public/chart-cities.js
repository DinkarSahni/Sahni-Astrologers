/*! India place data adapted from GeoNames (https://www.geonames.org/) via cities.json@1.1.65, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Labels, search aliases and application IDs adapted for Sahni Astrologers. See docs/india-places.md. */
import { indiaPlaceRows, indiaRegionNames, indiaDistrictNames, indiaSourceVersion } from './chart-india-data.js';

/** The original supported places retain their stable IDs and coordinates. */
const city = (id, name, lat, lon, timeZone = 'Asia/Kolkata') => Object.freeze({ id, name, lat, lon, timeZone });
const legacyCities = Object.freeze([
  city('jalandhar', 'Jalandhar, Punjab, India', 31.3260, 75.5762),
  city('ludhiana', 'Ludhiana, Punjab, India', 30.9010, 75.8573),
  city('amritsar', 'Amritsar, Punjab, India', 31.6340, 74.8723),
  city('chandigarh', 'Chandigarh, India', 30.7333, 76.7794),
  city('patiala', 'Patiala, Punjab, India', 30.3398, 76.3869),
  city('bathinda', 'Bathinda, Punjab, India', 30.2110, 74.9455),
  city('pathankot', 'Pathankot, Punjab, India', 32.2643, 75.6521),
  city('mohali', 'Mohali, Punjab, India', 30.7046, 76.7179),
  city('phagwara', 'Phagwara, Punjab, India', 31.2211, 75.7706),
  city('kapurthala', 'Kapurthala, Punjab, India', 31.3804, 75.3795),
  city('hoshiarpur', 'Hoshiarpur, Punjab, India', 31.5143, 75.9115),
  city('delhi', 'New Delhi, India', 28.6139, 77.2090),
  city('mumbai', 'Mumbai, Maharashtra, India', 19.0760, 72.8777),
  city('kolkata', 'Kolkata, West Bengal, India', 22.5726, 88.3639),
  city('chennai', 'Chennai, Tamil Nadu, India', 13.0827, 80.2707),
  city('bengaluru', 'Bengaluru, Karnataka, India', 12.9716, 77.5946),
  city('hyderabad', 'Hyderabad, Telangana, India', 17.3850, 78.4867),
  city('pune', 'Pune, Maharashtra, India', 18.5204, 73.8567),
  city('ahmedabad', 'Ahmedabad, Gujarat, India', 23.0225, 72.5714),
  city('surat', 'Surat, Gujarat, India', 21.1702, 72.8311),
  city('jaipur', 'Jaipur, Rajasthan, India', 26.9124, 75.7873),
  city('lucknow', 'Lucknow, Uttar Pradesh, India', 26.8467, 80.9462),
  city('kanpur', 'Kanpur, Uttar Pradesh, India', 26.4499, 80.3319),
  city('agra', 'Agra, Uttar Pradesh, India', 27.1767, 78.0081),
  city('varanasi', 'Varanasi, Uttar Pradesh, India', 25.3176, 82.9739),
  city('patna', 'Patna, Bihar, India', 25.5941, 85.1376),
  city('bhopal', 'Bhopal, Madhya Pradesh, India', 23.2599, 77.4126),
  city('indore', 'Indore, Madhya Pradesh, India', 22.7196, 75.8577),
  city('nagpur', 'Nagpur, Maharashtra, India', 21.1458, 79.0882),
  city('kochi', 'Kochi, Kerala, India', 9.9312, 76.2673),
  city('thiruvananthapuram', 'Thiruvananthapuram, Kerala, India', 8.5241, 76.9366),
  city('bhubaneswar', 'Bhubaneswar, Odisha, India', 20.2961, 85.8245),
  city('guwahati', 'Guwahati, Assam, India', 26.1445, 91.7362),
  city('shimla', 'Shimla, Himachal Pradesh, India', 31.1048, 77.1734),
  city('dehradun', 'Dehradun, Uttarakhand, India', 30.3165, 78.0322),
  city('jammu', 'Jammu, India', 32.7357, 74.8691),
  city('srinagar', 'Srinagar, India', 34.0837, 74.7973),
  city('london', 'London, United Kingdom', 51.5074, -0.1278, 'Europe/London'),
  city('new-york', 'New York, United States', 40.7128, -74.0060, 'America/New_York'),
  city('toronto', 'Toronto, Canada', 43.6532, -79.3832, 'America/Toronto'),
  city('sydney', 'Sydney, Australia', -33.8688, 151.2093, 'Australia/Sydney'),
  city('dubai', 'Dubai, United Arab Emirates', 25.2048, 55.2708, 'Asia/Dubai'),
  city('singapore', 'Singapore', 1.3521, 103.8198, 'Asia/Singapore'),
]);

// Geographic names and spellings are search aids, not substitutions for a
// visitor's selected birthplace. District/state labels remain visible.
const aliasGroups = [
  ['Mumbai', 'Bombay', 'मुंबई', 'बम्बई'],
  ['Kolkata', 'Calcutta', 'कोलकाता', 'कलकत्ता'],
  ['Chennai', 'Madras', 'चेन्नई', 'मद्रास'],
  ['Bengaluru', 'Bangalore', 'बेंगलुरु', 'बैंगलोर'],
  ['Prayagraj', 'Allahabad', 'प्रयागराज', 'इलाहाबाद'],
  ['Gurugram', 'Gurgaon', 'गुरुग्राम', 'गुड़गांव'],
  ['Puducherry', 'Pondicherry', 'पुडुचेरी', 'पांडिचेरी'],
  ['Varanasi', 'Banaras', 'Benares', 'Kashi', 'वाराणसी', 'बनारस', 'काशी'],
  ['Kochi', 'Cochin', 'कोच्चि'],
  ['Thiruvananthapuram', 'Trivandrum', 'तिरुवनंतपुरम'],
  ['Mysuru', 'Mysore', 'मैसूर'],
  ['Mangaluru', 'Mangalore', 'मंगलुरु'],
  ['Belagavi', 'Belgaum', 'बेलगावी'],
  ['Kalaburagi', 'Gulbarga', 'कलबुर्गी'],
  ['Jalandhar', 'Jullundur', 'जालंधर', 'जालन्धर', 'ਜਲੰਧਰ'],
  ['Amritsar', 'अमृतसर', 'ਅੰਮ੍ਰਿਤਸਰ'],
  ['Ludhiana', 'लुधियाना', 'ਲੁਧਿਆਣਾ'],
  ['Jaipur', 'जयपुर'], ['Lucknow', 'लखनऊ'], ['Patna', 'पटना'],
  ['Hyderabad', 'हैदराबाद'], ['Pune', 'Poona', 'पुणे'],
  ['Ahmedabad', 'अहमदाबाद'], ['Bhopal', 'भोपाल'], ['Indore', 'इंदौर'],
  ['Guwahati', 'Gauhati', 'गुवाहाटी'], ['Bhubaneswar', 'भुवनेश्वर'],
  ['Dehradun', 'Dehra Dun', 'देहरादून'], ['Shimla', 'Simla', 'शिमला'],
  ['Jammu', 'जम्मू'], ['Srinagar', 'श्रीनगर'], ['Leh', 'लेह'],
  ['Itanagar', 'ईटानगर'], ['Kavaratti', 'कवरत्ती'],
];
const scopedAliases = [
  { region: 'Karnataka', names: ['Vijayapura', 'Bijapur', 'विजयपुर'] },
  { region: 'Maharashtra', names: ['Aurangabad', 'Chhatrapati Sambhajinagar', 'Sambhajinagar', 'छत्रपति संभाजीनगर'] },
  { region: 'Maharashtra', names: ['Osmanabad', 'Dharashiv', 'धाराशिव'] },
  { region: 'Maharashtra', names: ['Ahmednagar', 'Ahilyanagar', 'अहिल्यानगर'] },
  { region: 'Punjab', names: ['Mohali', 'Ajitgarh', 'Sahibzada Ajit Singh Nagar', 'SAS Nagar', 'मोहाली'] },
  { region: 'Delhi', names: ['New Delhi', 'Delhi', 'नई दिल्ली', 'दिल्ली'] },
  { region: 'Andaman and Nicobar Islands', names: ['Port Blair', 'Sri Vijaya Puram', 'पोर्ट ब्लेयर', 'श्री विजयपुरम'] },
];
const regionHindi = {
  'Andaman and Nicobar Islands': 'अंडमान निकोबार', 'Andhra Pradesh': 'आंध्र प्रदेश',
  'Arunachal Pradesh': 'अरुणाचल प्रदेश', Assam: 'असम', Bihar: 'बिहार',
  Chandigarh: 'चंडीगढ़', Chhattisgarh: 'छत्तीसगढ़',
  'Dadra and Nagar Haveli and Daman and Diu': 'दादरा नगर हवेली दमन दीव',
  Delhi: 'दिल्ली', Goa: 'गोवा', Gujarat: 'गुजरात', Haryana: 'हरियाणा',
  'Himachal Pradesh': 'हिमाचल प्रदेश', 'Jammu and Kashmir': 'जम्मू कश्मीर',
  Jharkhand: 'झारखंड', Karnataka: 'कर्नाटक', Kerala: 'केरल', Ladakh: 'लद्दाख',
  Lakshadweep: 'लक्षद्वीप', 'Madhya Pradesh': 'मध्य प्रदेश', Maharashtra: 'महाराष्ट्र',
  Manipur: 'मणिपुर', Meghalaya: 'मेघालय', Mizoram: 'मिजोरम', Nagaland: 'नागालैंड',
  Odisha: 'ओडिशा उड़ीसा', Puducherry: 'पुडुचेरी पांडिचेरी', Punjab: 'पंजाब',
  Rajasthan: 'राजस्थान', Sikkim: 'सिक्किम', 'Tamil Nadu': 'तमिल नाडु',
  Telangana: 'तेलंगाना', Tripura: 'त्रिपुरा', 'Uttar Pradesh': 'उत्तर प्रदेश',
  Uttarakhand: 'उत्तराखंड उत्तरांचल', 'West Bengal': 'पश्चिम बंगाल',
};
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en').replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const aliasIndex = new Map(aliasGroups.flatMap(group => group.map(alias => [normalize(alias), group])));
const scopedAliasIndex = new Map(scopedAliases.flatMap(group => group.names.map(alias => [`${group.region}|${normalize(alias)}`, group.names])));
function aliasesFor(placeName, region) {
  const key = normalize(placeName);
  const shared = aliasIndex.get(key) || [];
  const scoped = scopedAliasIndex.get(`${region}|${key}`) || [];
  return [...new Set([...shared, ...scoped])].filter(alias => normalize(alias) !== key);
}
const overseasCountry = { london: 'GB', 'new-york': 'US', toronto: 'CA', sydney: 'AU', dubai: 'AE', singapore: 'SG' };
const specialRegion = { chandigarh: 'Chandigarh', delhi: 'Delhi', jammu: 'Jammu and Kashmir', srinagar: 'Jammu and Kashmir' };
const sourceCities = indiaPlaceRows.map(([id, placeName, regionIndex, districtIndex, lat, lon]) => {
  const region = indiaRegionNames[regionIndex], district = indiaDistrictNames[districtIndex];
  const qualifiers = [placeName, district && normalize(district) !== normalize(placeName) && normalize(district) !== normalize(region) ? district : '', region, 'India'].filter(Boolean);
  return { id, name: qualifiers.join(', '), placeName, region, district, country: 'IN', lat, lon, timeZone: 'Asia/Kolkata', aliases: aliasesFor(placeName, region), source: 'GeoNames' };
});
const mergedSourceIds = new Set();
const preserved = legacyCities.map(place => {
  const placeName = place.name.split(',')[0], country = overseasCountry[place.id] || 'IN';
  const region = country === 'IN' ? specialRegion[place.id] || place.name.split(',')[1]?.trim() || '' : '';
  const aliases = aliasesFor(placeName, region);
  const matchingNames = new Set([placeName, ...aliases].map(normalize));
  const match = country === 'IN' ? sourceCities.filter(candidate => candidate.region === region && matchingNames.has(normalize(candidate.placeName)) && Math.abs(candidate.lat - place.lat) < .25 && Math.abs(candidate.lon - place.lon) < .25).sort((a, b) => Math.hypot(a.lat - place.lat, a.lon - place.lon) - Math.hypot(b.lat - place.lat, b.lon - place.lon))[0] : null;
  if (match) mergedSourceIds.add(match.id);
  const district = match?.district || '';
  const name = country === 'IN' ? [placeName, district && normalize(district) !== normalize(placeName) && normalize(district) !== normalize(region) ? district : '', region, 'India'].filter(Boolean).join(', ') : place.name;
  return Object.freeze({ ...place, name, placeName, country, region, district, aliases: Object.freeze(aliases), source: 'Curated city-centre coordinates', ...(match ? { gazetteerId: match.id } : {}) });
});
const combinedPlaces = [...preserved, ...sourceCities.filter(place => !mergedSourceIds.has(place.id))];
const qualifiedLabelCounts = new Map();
combinedPlaces.forEach(place => qualifiedLabelCounts.set(place.name, (qualifiedLabelCounts.get(place.name) || 0) + 1));
// Some settlements share even the same district/state label. Retain both records
// and expose coordinates in those labels so the visitor can distinguish them.
export const cities = Object.freeze(combinedPlaces.map(place => Object.freeze({
  ...place,
  name: qualifiedLabelCounts.get(place.name) > 1 ? `${place.name} (${place.lat.toFixed(5)}°, ${place.lon.toFixed(5)}°)` : place.name,
  aliases: Object.freeze(place.aliases),
})));
export const indiaRegions = Object.freeze([...indiaRegionNames]);
export const placeCoverage = Object.freeze({ indiaPlaces: cities.filter(place => place.country === 'IN').length, totalPlaces: cities.length, regions: indiaRegions.length, sourceRecords: indiaPlaceRows.length, source: `GeoNames via cities.json ${indiaSourceVersion}`, license: 'CC BY 4.0' });

const searchIndex = cities.map((place, index) => ({
  place, index, regionKey: normalize(place.region),
  primary: normalize(place.placeName),
  aliases: place.aliases.map(normalize),
  full: normalize(`${place.name} ${place.aliases.join(' ')} ${regionHindi[place.region] || ''}`),
}));

/** Search on-device; selecting a returned record is still required to calculate. */
export function searchCities(query = '', { limit = 60, state = '' } = {}) {
  const text = normalize(String(query).slice(0, 200));
  const tokens = text.split(' ').filter(Boolean);
  const maximum = Math.max(1, Math.min(100, Number.isFinite(Number(limit)) ? Math.trunc(Number(limit)) : 60));
  const region = state ? normalize(state) : '';
  const matches = searchIndex.filter(entry => (!region || entry.regionKey === region) && tokens.every(token => entry.full.includes(token)));
  const score = entry => {
    if (!text) return entry.place.country === 'IN' ? (entry.index < legacyCities.length ? -2 : 0) : 1;
    if (entry.primary === text) return -5;
    if (entry.aliases.includes(text)) return -4;
    if (entry.primary.startsWith(text)) return -3;
    if (entry.aliases.some(alias => alias.startsWith(text))) return -2;
    if (entry.primary.includes(text)) return -1;
    return 0;
  };
  matches.sort((a, b) => score(a) - score(b) || a.index - b.index);
  return matches.slice(0, maximum).map(entry => entry.place);
}
