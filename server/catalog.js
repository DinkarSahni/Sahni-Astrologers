export const SERVICES = Object.freeze([
  { id: 'kundali', name: 'Kundali Reading', amount: 110000, currency: 'INR', requiresSlot: true, requiresAddress: false },
  { id: 'marriage', name: 'Marriage Matching', amount: 150000, currency: 'INR', requiresSlot: true, requiresAddress: false },
  { id: 'career', name: 'Career & Finance', amount: 110000, currency: 'INR', requiresSlot: true, requiresAddress: false },
  { id: 'teva-digital', name: 'Digital Teva', amount: 70000, currency: 'INR', requiresSlot: false, requiresAddress: false },
  { id: 'teva-physical', name: 'Physical Teva', amount: 90000, currency: 'INR', requiresSlot: false, requiresAddress: true },
].map(Object.freeze));
// Reserve the longest consultation window (90 minutes) for every start time.
// This conservative schedule stays inside the published opening hours.
export const SLOT_TIMES = Object.freeze(['10:00', '11:30', '15:00']);
export const TIMEZONE = 'Asia/Kolkata';
export function appointmentTimestamp(date, time) { return Date.parse(`${date}T${time}:00+05:30`); }
export function todayIndia(now = Date.now()) { return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}
export function slotIsInSchedule(date, time, now = Date.now()) {
  const weekday = new Date(`${date}T12:00:00+05:30`).getUTCDay();
  return validDate(date) && SLOT_TIMES.includes(time)
    && weekday !== 0 && (weekday !== 4 || time === '15:00')
    && appointmentTimestamp(date, time) > now + 60 * 60 * 1000
    && appointmentTimestamp(date, time) < now + 180 * 86400000;
}
