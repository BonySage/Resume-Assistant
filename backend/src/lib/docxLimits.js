// A DOCX is a ZIP archive. A "zip bomb" under the 10 MB upload limit can
// expand to gigabytes (a 300 KB file used 316 MB when mammoth unpacked it),
// enough to crash the server. checkDocxArchive runs before mammoth: it
// decompresses every entry with a hard cap on the output, because the sizes
// written in the ZIP headers can be faked.
import zlib from 'node:zlib';

// A real resume DOCX unpacks to well under 15 MB, even with a photo.
export const MAX_DOCX_UNCOMPRESSED_BYTES = 30 * 1024 * 1024;
export const MAX_DOCX_ENTRIES = 1000;

const EOCD_SIGNATURE = 0x06054b50; // end of central directory
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;

// A user-facing "file too big" error; the upload route shows its message.
// Also used by parseResume.js for page and character limits.
export function resumeTooLongError(message) {
  const error = new Error(message);
  error.code = 'RESUME_TOO_LONG';
  return error;
}

function tooLarge() {
  return resumeTooLongError('This DOCX file is too large to process. Save it again from Word or upload a PDF instead.');
}

// Malformed archives get a plain Error; the upload route reports those as unreadable.
function malformed(what) {
  return new Error(`Malformed DOCX: ${what}`);
}

function findEndOfCentralDirectory(buffer) {
  // The record is 22 bytes plus a comment of up to 65,535 bytes, at the very end.
  const stop = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= stop; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  throw malformed('no end of central directory');
}

export function checkDocxArchive(buffer) {
  if (buffer.length < 22) throw malformed('too short');
  const eocd = findEndOfCentralDirectory(buffer);
  const diskNumber = buffer.readUInt16LE(eocd + 4);
  const centralDisk = buffer.readUInt16LE(eocd + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocd + 8);
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  // 0xffff / 0xffffffff in ANY of these fields mean ZIP64, which no resume
  // needs. JSZip (inside mammoth) then takes the real offsets from the ZIP64
  // record, so this check would be looking at different entries.
  if ([diskNumber, centralDisk, entriesOnDisk, entryCount].includes(0xffff) ||
      centralSize === 0xffffffff || centralOffset === 0xffffffff) throw tooLarge();
  if (entryCount > MAX_DOCX_ENTRIES) throw tooLarge();
  // The central directory must end exactly where the end record starts. If
  // not, JSZip shifts every offset (data "prepended" to the archive), and
  // would again read different entries from the ones checked here.
  if (centralOffset + centralSize !== eocd) throw malformed('central directory size or offset mismatch');

  let budget = MAX_DOCX_UNCOMPRESSED_BYTES;
  let pos = centralOffset;
  for (let n = 0; n < entryCount; n++) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== CENTRAL_SIGNATURE) throw malformed('bad central directory');
    const method = buffer.readUInt16LE(pos + 10);
    const compressedSize = buffer.readUInt32LE(pos + 20);
    const nameLength = buffer.readUInt16LE(pos + 28);
    const extraLength = buffer.readUInt16LE(pos + 30);
    const commentLength = buffer.readUInt16LE(pos + 32);
    const localOffset = buffer.readUInt32LE(pos + 42);
    pos += 46 + nameLength + extraLength + commentLength;

    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) throw malformed('bad local header');
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    if (dataStart + compressedSize > buffer.length) throw malformed('entry runs past end of file');
    const data = buffer.subarray(dataStart, dataStart + compressedSize);

    let size;
    if (method === STORED) {
      size = data.length;
    } else if (method === DEFLATED) {
      try {
        // Stops as soon as the output would exceed what's left of the budget.
        size = zlib.inflateRawSync(data, { maxOutputLength: budget + 1 }).length;
      } catch (err) {
        if (err.code === 'ERR_BUFFER_TOO_LARGE') throw tooLarge();
        throw malformed('corrupt compressed data');
      }
    } else {
      throw malformed(`unsupported compression method ${method}`);
    }
    budget -= size;
    if (budget < 0) throw tooLarge();
  }
  // JSZip ignores the entry count and reads every central header it finds, so
  // an archive declaring fewer entries than it holds could hide a bomb.
  if (pos !== eocd) throw malformed('entry count does not match the central directory');
}
