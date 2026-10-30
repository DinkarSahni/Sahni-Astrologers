const $ = (selector) => document.querySelector(selector);
let csrfToken = null;
let bookings = [];
function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined && text !== null) el.textContent = String(text); if (className) el.className = className; return el; }
async function api(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(path, { credentials: 'same-origin', ...options, signal: controller.signal, headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(csrfToken && options.method && options.method !== 'GET' ? { 'X-CSRF-Token': csrfToken } : {}), ...options.headers } });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) { showLogin(); throw new Error('Please sign in to continue.'); }
    if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
    return result;
  } catch (error) { if (error.name === 'AbortError') throw new Error('The request timed out. Please try again.'); throw error; }
  finally { clearTimeout(timeout); }
}
function status(text, error = false) { $('#admin-status').textContent = text; $('#admin-status').className = error ? 'error' : ''; }
function showLogin() { csrfToken = null; bookings = []; $('#admin-dashboard').hidden = true; $('#admin-login').hidden = false; $('#admin-bookings').replaceChildren(); $('#admin-contacts').replaceChildren(); $('#admin-closures').replaceChildren(); }
function recordFields(target, fields) {
  const dl = node('dl');
  fields.forEach(([label, value]) => { dl.append(node('dt', label), node('dd', value || '—')); });
  target.append(dl);
}
function renderBookings() {
  const filter = $('#admin-filter').value;
  const selected = bookings.filter((booking) => filter === 'all' || booking.status === filter || (filter === 'payment_pending' && ['awaiting_payment', 'pending'].includes(booking.status)));
  $('#admin-bookings').replaceChildren(...selected.map((booking) => {
    const card = node('article', undefined, 'admin-card');
    card.append(node('h3', booking.serviceName), node('p', booking.status, 'status-badge'));
    const details = [
      ['Booking reference', booking.bookingId], ['Customer', booking.name], ['Phone', booking.phone], ['Email', booking.email],
      ['Appointment · IST', booking.date ? `${booking.date} · ${booking.time || ''}` : 'Teva preparation — no appointment'],
      ['Amount', new Intl.NumberFormat('en-IN', { style: 'currency', currency: booking.currency }).format(booking.amount / 100)],
      ['Birth date', booking.birthDate], ['Birth time', booking.birthTime], ['Birth place', booking.birthPlace], ['Delivery address', booking.address], ['Notes', booking.notes],
      ['Payment ID', booking.paymentId], ['Created', booking.createdAt ? new Date(booking.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : ''],
    ];
    if (booking.serviceId?.startsWith('teva-')) details.splice(5, 0, ['Teva language', booking.tevaLanguage === 'hi' ? 'हिन्दी' : 'English']);
    recordFields(card, details);
    if (booking.paymentAttempts?.length) {
      card.append(node('h4', 'Payment attempts'));
      const attempts = node('ul');
      booking.paymentAttempts.forEach((attempt) => attempts.append(node('li', `${attempt.paymentId} · ${attempt.status} · Refunded ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: booking.currency }).format((attempt.amountRefunded || 0) / 100)}`)));
      card.append(attempts);
    }
    return card;
  }));
  if (!selected.length) $('#admin-bookings').append(node('p', 'No bookings with this status.'));
}
function renderContacts(contacts) {
  $('#admin-contacts').replaceChildren(...contacts.map((contact) => {
    const card = node('article', undefined, 'admin-card'); card.append(node('h3', contact.topic));
    recordFields(card, [['Name', contact.name], ['Contact', contact.contact], ['Message', contact.message], ['Received · IST', new Date(contact.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })]]);
    return card;
  }));
  if (!contacts.length) $('#admin-contacts').append(node('p', 'No messages received yet.'));
}
function renderClosures(closures) {
  $('#admin-closures').replaceChildren(...closures.map((closure) => {
    const card = node('article', undefined, 'admin-card'); card.append(node('p', `${closure.date} · ${closure.time || 'Full day'} · IST`));
    const remove = node('button', 'Reopen this time', 'button button-outline'); remove.type = 'button';
    remove.addEventListener('click', async () => { remove.disabled = true; try { await api(`/api/admin/closures/${encodeURIComponent(closure.id)}`, { method: 'DELETE' }); await loadDashboard(); } catch (error) { status(error.message, true); remove.disabled = false; } });
    card.append(remove); return card;
  }));
  if (!closures.length) $('#admin-closures').append(node('p', 'No additional closure dates.'));
}
async function loadDashboard() {
  $('#admin-login').hidden = true;
  $('#admin-dashboard').hidden = false;
  const [bookingData, contactData, closureData] = await Promise.all([api('/api/admin/bookings'), api('/api/admin/contacts'), api('/api/admin/closures')]);
  bookings = bookingData.bookings;
  renderBookings(); renderContacts(contactData.contacts); renderClosures(closureData.closures);
  status('Records updated. Times are shown in IST. Sign out when you finish.');
}
$('#admin-filter').addEventListener('change', renderBookings);
$('#admin-login').addEventListener('submit', async (event) => {
  event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true;
  try { const result = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: $('#admin-password').value }) }); csrfToken = result.csrfToken; $('#admin-password').value = ''; await loadDashboard(); }
  catch (error) { status(error.message, true); }
  finally { button.disabled = false; }
});
$('#admin-refresh').addEventListener('click', async () => { try { await loadDashboard(); } catch (error) { status(error.message, true); } });
$('#admin-logout').addEventListener('click', async () => { try { await api('/api/admin/logout', { method: 'POST' }); showLogin(); status('Signed out.'); } catch (error) { status(error.message, true); } });
$('#closure-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true;
  try { await api('/api/admin/closures', { method: 'POST', body: JSON.stringify({ date: $('#closure-date').value, time: $('#closure-time').value || undefined }) }); form.reset(); await loadDashboard(); }
  catch (error) { status(error.message, true); }
  finally { button.disabled = false; }
});
try { const session = await api('/api/admin/session'); if (session.authenticated) { csrfToken = session.csrfToken; await loadDashboard(); } else showLogin(); }
catch (error) { showLogin(); status(error.message, true); }
