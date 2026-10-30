import { createChartDiagram } from '/chart-diagram.js';
import { divisionDefinitions } from '/chart-divisions.js';

const SIGN_HI = ['मेष','वृषभ','मिथुन','कर्क','सिंह','कन्या','तुला','वृश्चिक','धनु','मकर','कुंभ','मीन'];
const SIGN_EN = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const PLANET_HI = { Sun:'सूर्य',Moon:'चन्द्र',Mars:'मंगल',Mercury:'बुध',Jupiter:'गुरु',Venus:'शुक्र',Saturn:'शनि',Rahu:'राहु',Ketu:'केतु' };
const WEEKDAY_HI = { Sunday:'रविवार',Monday:'सोमवार',Tuesday:'मंगलवार',Wednesday:'बुधवार',Thursday:'गुरुवार',Friday:'शुक्रवार',Saturday:'शनिवार' };
const VARGA_HI = { D1:'राशि',D2:'होरा',D3:'द्रेष्काण',D4:'चतुर्थांश',D7:'सप्तमांश',D9:'नवांश',D10:'दशमांश',D12:'द्वादशांश',D16:'षोडशांश',D20:'विंशांश',D24:'चतुर्विंशांश',D27:'भांश',D30:'त्रिंशांश',D40:'खवेदांश',D45:'अक्षवेदांश',D60:'षष्ट्यंश' };
const CONVENTION_HI = {
  D1:'जन्म की निरयन राशि और पूर्ण राशि भाव।', D2:'विषम राशि में सिंह फिर कर्क; सम राशि में कर्क फिर सिंह।', D3:'जन्म राशि, उससे पाँचवीं और नौवीं राशि।', D4:'जन्म राशि, उससे चौथी, सातवीं और दसवीं राशि।',
  D7:'विषम राशि में जन्म राशि से, सम राशि में उससे सातवीं राशि से आगे गिनती।', D9:'चर राशि में जन्म राशि से, स्थिर में उससे नौवीं और द्विस्वभाव में उससे पाँचवीं राशि से गिनती।', D10:'विषम राशि में जन्म राशि से, सम राशि में उससे नौवीं राशि से आगे गिनती।', D12:'जन्म राशि से आगे गिनती।',
  D16:'चर, स्थिर और द्विस्वभाव राशि में क्रमशः मेष, सिंह और धनु से आगे गिनती।', D20:'चर, स्थिर और द्विस्वभाव राशि में क्रमशः मेष, धनु और सिंह से आगे गिनती।', D24:'विषम राशि में सिंह और सम राशि में कर्क से आगे गिनती।', D27:'अग्नि, पृथ्वी, वायु और जल राशि में क्रमशः मेष, कर्क, तुला और मकर से आगे गिनती।',
  D30:'विषम राशि: ०–५° मेष, ५–१०° कुंभ, १०–१८° धनु, १८–२५° मिथुन, २५–३०° तुला। सम राशि: ०–५° वृषभ, ५–१२° कन्या, १२–२०° मीन, २०–२५° मकर, २५–३०° वृश्चिक।',
  D40:'विषम राशि में मेष और सम राशि में तुला से आगे गिनती।', D45:'चर, स्थिर और द्विस्वभाव राशि में क्रमशः मेष, सिंह और धनु से आगे गिनती।', D60:'जन्म राशि से आगे गिनने वाली पद्धति; सम राशि में उलटी गिनती नहीं। यह मेष से शुरू होने वाली पद्धति या देवता तालिका नहीं है।',
};
const COPY = {
  en: {
    library:'Explore the divisional charts',libraryHelp:'Compare the birth chart with one of 15 divisional charts. These are traditional sign allocations from the same calculated longitudes.',division:'Divisional chart',north:'North Indian',south:'South Indian',layout:'Chart layout',birth:'Birth chart · D1',lagna:'Lagna',placements:'Selected divisional placements',columns:['Planet','Divisional sign','House'],convention:'Calculation convention',
    northHelp:'North Indian layout keeps houses fixed. Numbers 1–12 identify signs, starting with Aries; H identifies the house. ℞ means retrograde; ? marks uncertain node motion near a station.',southHelp:'South Indian layout keeps signs fixed. Asc marks the ascendant; H identifies the whole-sign house. ℞ means retrograde; ? marks uncertain node motion near a station.',
    fineDivision:'Fine divisions, especially D60, are sensitive to small birth-time and coordinate differences. Confirm the birth record before interpreting them.',
    solar:'Sunrise & the traditional weekday',solarHelp:'Times use the selected place and its historical civil time zone. The sunrise-based Vara starts at the preceding sunrise, so a pre-dawn birth can have a different Vara from its civil weekday.',sunrise:'Sunrise · birth date',sunset:'Sunset · birth date',vara:'Sunrise-based Vara',dayLength:'Daylight duration',hour:'h',minute:'m',noEvent:'No event on this local date',unavailable:'Unavailable',solarNote:'Sea-level apparent solar upper limb with standard refraction. Local terrain, elevation and weather can shift observed times.',
    transitions:'Next Panchang boundaries',transitionHelp:'Approximate ending times for the limbs active at birth, displayed in the birth place’s local time. These are not a daily sunrise calendar.',transitionLabels:['Tithi ends','Nakshatra ends','Yoga ends','Karana ends'],
    periods:'Vimshottari periods',periodHelp:'Open a major period, then a sub-period, to see Pratyantardashas. The first period starts with the birth balance; all dates and times below are in IST.',current:'current',finePeriods:'Pratyantardasha',periodColumns:['Pratyantardasha','From · IST','Until · IST'],
  },
  hi: {
    library:'वर्ग कुंडलियाँ देखें',libraryHelp:'जन्म कुंडली की तुलना १५ वर्ग कुंडलियों में से किसी एक से करें। ये उन्हीं गणना किए गए अंशों का पारंपरिक राशि विभाजन हैं।',division:'वर्ग कुंडली',north:'उत्तर भारतीय',south:'दक्षिण भारतीय',layout:'कुंडली का प्रारूप',birth:'जन्म कुंडली · D1',lagna:'लग्न',placements:'चुनी हुई वर्ग कुंडली में ग्रह',columns:['ग्रह','वर्ग राशि','भाव'],convention:'गणना की पद्धति',
    northHelp:'उत्तर भारतीय प्रारूप में भाव स्थिर हैं। १–१२ अंक मेष से मीन तक राशियाँ हैं; भा भाव है। ℞ वक्री है; ? नोड की गति की अनिश्चितता दर्शाता है।',southHelp:'दक्षिण भारतीय प्रारूप में राशियाँ स्थिर हैं। लग्न चिह्न और भा भाव दर्शाते हैं। ℞ वक्री है; ? नोड की गति की अनिश्चितता दर्शाता है।',
    fineDivision:'सूक्ष्म वर्ग, विशेषकर D60, जन्म समय और निर्देशांक के छोटे अंतर से बदल सकते हैं। फलादेश से पहले जन्म रिकॉर्ड की पुष्टि करें।',
    solar:'सूर्योदय और पारंपरिक वार',solarHelp:'समय चुने हुए जन्म स्थान और उसके ऐतिहासिक नागरिक समय क्षेत्र में हैं। सूर्योदय आधारित वार पिछले सूर्योदय से शुरू होता है; भोर से पहले जन्म का वार नागरिक वार से अलग हो सकता है।',sunrise:'सूर्योदय · जन्म तारीख',sunset:'सूर्यास्त · जन्म तारीख',vara:'सूर्योदय आधारित वार',dayLength:'दिन की अवधि',hour:'घं',minute:'मि',noEvent:'इस स्थानीय तारीख को घटना नहीं',unavailable:'उपलब्ध नहीं',solarNote:'समुद्र तल, सूर्य के दृश्य ऊपरी किनारे और मानक अपवर्तन की गणना। भूभाग, ऊँचाई और मौसम से देखा गया समय बदल सकता है।',
    transitions:'अगली पंचांग सीमाएँ',transitionHelp:'जन्म के क्षण में चल रहे अंगों के अनुमानित समाप्ति समय, जन्म स्थान के स्थानीय समय में। यह दैनिक सूर्योदय पंचांग नहीं है।',transitionLabels:['तिथि समाप्त','नक्षत्र समाप्त','योग समाप्त','करण समाप्त'],
    periods:'विंशोत्तरी दशा',periodHelp:'प्रत्यंतर्दशाएँ देखने के लिए महादशा और फिर अंतर्दशा खोलें। पहली अवधि जन्म के समय शेष दशा से शुरू होती है। नीचे की तारीखें और समय IST में हैं।',current:'वर्तमान',finePeriods:'प्रत्यंतर्दशा',periodColumns:['प्रत्यंतर्दशा','शुरू · IST','समाप्त · IST'],
  },
};
const node = (tag, text, className) => { const el=document.createElement(tag); if(text!==undefined)el.textContent=String(text); if(className)el.className=className; return el; };
const planetName = (name,lang) => lang==='hi' ? PLANET_HI[name] || name : name;
const signName = (name,lang) => lang==='hi' ? SIGN_HI[SIGN_EN.indexOf(name)] || name : name;
const dateTime = (value,lang,timeZone='Asia/Kolkata') => new Intl.DateTimeFormat(lang==='hi'?'hi-IN-u-nu-deva':'en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone}).format(new Date(value));
const table = (headings,rows,id) => {
  const wrap=node('div',undefined,'table-wrap'); wrap.tabIndex=0;
  const el=node('table'); if(id)el.id=id;
  const head=node('thead'),tr=node('tr'),body=node('tbody');
  headings.forEach(text=>{const th=node('th',text);th.scope='col';tr.append(th);}); head.append(tr);
  rows.forEach(values=>{const row=node('tr');values.forEach(value=>row.append(node('td',value)));body.append(row);});
  el.append(head,body);wrap.append(el);return wrap;
};

export function renderDivisionExplorer(chart,{language='en',style='north',selectedDivision='D9',onStyleChange=()=>{},onDivisionChange=()=>{}}={}) {
  const copy=COPY[language],section=node('section',undefined,'chart-division-explorer'); section.id='chart-division-explorer';
  section.append(node('h3',copy.library),node('p',copy.libraryHelp,'fineprint'));
  const toolbar=node('div',undefined,'chart-display-toolbar'),field=node('div'),label=node('label',copy.division),select=node('select');
  select.id='chart-division';label.htmlFor=select.id;
  divisionDefinitions.filter(item=>item.id!=='D1').forEach(item=>{const option=node('option',`${item.id} · ${language==='hi'?VARGA_HI[item.id]:item.label}`);option.value=item.id;select.append(option);});
  select.value=chart.divisions[selectedDivision]&&selectedDivision!=='D1'?selectedDivision:'D9';
  field.append(label,select);toolbar.append(field);
  const layouts=node('div',undefined,'button-row chart-layout-choices');layouts.setAttribute('role','group');layouts.setAttribute('aria-label',copy.layout);
  for(const [value,text] of [['north',copy.north],['south',copy.south]]){
    const button=node('button',text,'button button-outline');button.type='button';button.dataset.chartStyleChoice=value;
    button.addEventListener('click',()=>{style=value;paint();onStyleChange(value);});layouts.append(button);
  }
  toolbar.append(layouts);section.append(toolbar);
  const diagrams=node('div',undefined,'chart-columns'),help=node('p',undefined,'fineprint'),convention=node('p',undefined,'fineprint chart-division-convention'),sensitivity=node('p',copy.fineDivision,'fineprint');
  section.append(diagrams,help,convention,sensitivity);
  const placements=node('section',undefined,'chart-divisional-placements');placements.id='chart-division-placements';
  function paint(){
    const id=select.value,selected=chart.divisions[id];
    diagrams.replaceChildren();
    for(const [chartId,title] of [['D1',copy.birth],[id,`${id} · ${language==='hi'?VARGA_HI[id]:selected.definition.label}`]]){
      const divided=chart.divisions[chartId],card=node('div');
      card.append(node('h4',title),node('p',`${copy.lagna}: ${signName(divided.ascendant.sign,language)}`,'chart-division-lagna'),createChartDiagram(divided,{language,style,division:chartId}));diagrams.append(card);
    }
    layouts.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.chartStyleChoice===style)));
    help.textContent=style==='north'?copy.northHelp:copy.southHelp;
    // The full convention remains visible even where software packages differ.
    convention.textContent=`${copy.convention} · ${id}: ${language==='hi'?CONVENTION_HI[id]:selected.definition.convention}`;
    sensitivity.hidden=selected.definition.factor<16;
    placements.replaceChildren(node('h3',`${copy.placements} · ${id}`),table(copy.columns,selected.planets.map(p=>[planetName(p.name,language),signName(p.sign,language),new Intl.NumberFormat(language==='hi'?'hi-IN-u-nu-deva':'en-IN').format(p.house)]),'chart-division-table'));
  }
  select.addEventListener('change',()=>{paint();onDivisionChange(select.value);});paint();
  return {section,placements};
}

export function renderSolarDetails(chart,language='en'){
  const copy=COPY[language],solar=chart.solarDay;
  const section=node('section',undefined,'chart-timing-section');section.id='chart-solar-day';
  if(!solar)return section;
  section.append(node('h3',copy.solar),node('p',copy.solarHelp,'fineprint'));
  const list=node('dl',undefined,'panchang-grid');
  const formatEvent=value=>value?dateTime(value,language,chart.city.timeZone):copy.noEvent;
  const duration=solar.dayLengthSeconds===null?copy.unavailable:`${new Intl.NumberFormat(language==='hi'?'hi-IN-u-nu-deva':'en-IN').format(Math.floor(solar.dayLengthSeconds/3600))} ${copy.hour} ${new Intl.NumberFormat(language==='hi'?'hi-IN-u-nu-deva':'en-IN').format(Math.floor(solar.dayLengthSeconds%3600/60))} ${copy.minute}`;
  [[copy.sunrise,formatEvent(solar.sunrise)],[copy.sunset,formatEvent(solar.sunset)],[copy.vara,solar.vara?(language==='hi'?WEEKDAY_HI[solar.vara.name]:solar.vara.name):copy.unavailable],[copy.dayLength,duration]].forEach(([title,value])=>{const pair=node('div');pair.append(node('dt',title),node('dd',value));list.append(pair);});
  section.append(list,node('p',`${chart.city.timeZone} · ${copy.solarNote}`,'fineprint'));return section;
}

export function renderPanchangTransitions(chart,language='en'){
  const copy=COPY[language],section=node('section',undefined,'chart-timing-section');section.id='chart-panchang-transitions';
  section.append(node('h3',copy.transitions),node('p',copy.transitionHelp,'fineprint'));
  const list=node('dl',undefined,'panchang-grid');
  ['tithi','nakshatra','yoga','karana'].forEach((key,index)=>{const transition=chart.panchangTransitions?.[key],pair=node('div');pair.dataset.panchangLimb=key;if(transition?.endsAt)pair.dataset.endsAt=transition.endsAt;pair.append(node('dt',copy.transitionLabels[index]),node('dd',transition?.endsAt?dateTime(transition.endsAt,language,chart.city.timeZone):copy.unavailable));list.append(pair);});
  section.append(list);return section;
}

/** Finer-period tables are mounted on demand rather than rendering 800 rows. */
export function renderDashaTree(chart,language='en'){
  const copy=COPY[language],section=node('section',undefined,'chart-dasha-section');
  section.append(node('h3',copy.periods),node('p',copy.periodHelp,'muted'));
  const periods=node('div',undefined,'dasha-list');
  const summary=period=>`${planetName(period.planet,language)} · ${dateTime(period.start,language)} — ${dateTime(period.end,language)}${period.isCurrent?` · ${copy.current}`:''}`;
  chart.dashas.forEach(period=>{
    const major=node('details');major.dataset.dashaPlanet=period.planet;major.append(node('summary',summary(period)));
    major.addEventListener('toggle',()=>{
      if(!major.open||major.dataset.loaded)return;major.dataset.loaded='true';
      const subperiods=node('div',undefined,'dasha-subperiod-list');
      period.antardashas.forEach(sub=>{
        const detail=node('details',undefined,'dasha-subperiod');detail.dataset.dashaPlanet=sub.planet;detail.append(node('summary',summary(sub)));
        detail.addEventListener('toggle',()=>{if(!detail.open||detail.dataset.loaded)return;detail.dataset.loaded='true';detail.append(node('p',copy.finePeriods,'fineprint'),table(copy.periodColumns,(sub.pratyantardashas||[]).map(fine=>[`${planetName(fine.planet,language)}${fine.isCurrent?` · ${copy.current}`:''}`,dateTime(fine.start,language),dateTime(fine.end,language)])));});
        subperiods.append(detail);
      });major.append(subperiods);
    });periods.append(major);
  });section.append(periods);return section;
}
