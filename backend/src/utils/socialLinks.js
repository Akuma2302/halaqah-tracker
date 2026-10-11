// Turns what someone typed for WhatsApp, Instagram or TikTok (a number, a
// username or a link) into a full https link to that service. Anything that
// isn't one of those is refused, so a stored link can only ever open the
// service it claims to.

function fail(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// A link to one of `hosts` (with or without "www." or the scheme), or null.
function linkTo(input, hosts) {
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (!hosts.includes(host)) return null;
  url.protocol = 'https:';
  url.username = '';
  url.password = '';
  url.port = '';
  return url.toString();
}

function whatsapp(input) {
  const value = String(input || '').trim();
  if (!value) return '';
  if (/[a-z]/i.test(value)) {
    const link = linkTo(value, ['wa.me', 'api.whatsapp.com', 'chat.whatsapp.com', 'whatsapp.com']);
    if (!link) throw fail('WhatsApp: enter a phone number or a wa.me link');
    return link;
  }
  let digits = value.replace(/\D/g, '');
  // A local Malaysian number ("012-345 6789") becomes "6012...".
  if (digits.startsWith('0')) digits = `6${digits}`;
  if (digits.length < 8 || digits.length > 15) throw fail('WhatsApp: that phone number does not look right');
  return `https://wa.me/${digits}`;
}

function profile(input, { name, hosts, username, build }) {
  const value = String(input || '').trim();
  if (!value) return '';
  if (value.includes('.') && value.includes('/')) {
    const link = linkTo(value, hosts);
    if (!link) throw fail(`${name}: enter your username or a link to ${hosts[0]}`);
    return link;
  }
  const handle = value.replace(/^@/, '');
  if (!username.test(handle)) throw fail(`${name}: that username does not look right`);
  return build(handle);
}

const instagram = (input) =>
  profile(input, {
    name: 'Instagram',
    hosts: ['instagram.com'],
    username: /^[A-Za-z0-9._]{1,30}$/,
    build: (handle) => `https://instagram.com/${handle}`
  });

const tiktok = (input) =>
  profile(input, {
    name: 'TikTok',
    hosts: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
    username: /^[A-Za-z0-9._]{2,24}$/,
    build: (handle) => `https://www.tiktok.com/@${handle}`
  });

module.exports = { whatsapp, instagram, tiktok };
