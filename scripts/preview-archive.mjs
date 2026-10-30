import { crc32, deflateRawSync } from 'node:zlib';

const instructions = [
  'SAHNI ASTROLOGERS - WEBSITE PREVIEW',
  '',
  '1. Extract this ZIP file to a folder on your device.',
  '2. Open index.html in Chrome, Safari, Edge, or another full browser.',
  '',
  'Opening the website inside a ChatGPT file viewer may show plain links or',
  'an incomplete page because that viewer can restrict styles and scripts.',
  'Download and extract the ZIP, then open index.html in your browser.',
  '',
  'The website styling, fonts, navigation, and Kundali calculator are included.',
  'Ordinary navigation and chart calculations work offline. Google Maps loads',
  'only when you request it; external links need an internet connection.',
  '',
  'This is a local preview. It cannot reserve appointments or take payments.',
  'An enquiry prepares a WhatsApp draft that you must open and send yourself.',
  'Real bookings and verified payments require the separately deployed server.',
  '',
].join('\r\n');

// ZIP's DOS timestamps have two-second precision and no timezone field.
function dosTimestamp(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new TypeError('A valid archive modification date is required.');
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

// A small standard ZIP32 archive. The HTML bytes are preserved exactly.
export function createPreviewArchive(html, { modifiedAt = new Date() } = {}) {
  const stamp = dosTimestamp(modifiedAt);
  const files = [
    ['index.html', Buffer.isBuffer(html) ? html : Buffer.from(html, 'utf8')],
    ['START-HERE.txt', Buffer.from(instructions, 'utf8')],
  ];
  const localRecords = [], centralRecords = [];
  let offset = 0;
  for (const [filename, bytes] of files) {
    const name = Buffer.from(filename, 'utf8');
    const compressed = deflateRawSync(bytes);
    const checksum = crc32(bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    localRecords.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(0x20, 38);
    central.writeUInt32LE(offset, 42);
    centralRecords.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(centralRecords);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localRecords, directory, end]);
}
