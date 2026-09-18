/**
 * Repair of double-encoded UTF-8 ("mojibake") inherited from the legacy MySQL
 * database.
 *
 * The legacy PHP application wrote UTF-8 bytes through a latin1 (cp1252)
 * connection into utf8 columns, so MariaDB stored e.g. `ö` (C3 B6) as the two
 * characters `Ã¶`. Records edited repeatedly picked up several layers. A
 * mysqldump with `SET NAMES utf8` exports the stored form faithfully, which is
 * why the corruption is already present in the dump we import from.
 *
 * Detection is a round-trip test rather than a lookup table: re-encode the
 * string as cp1252 bytes and strictly decode as UTF-8. Correctly encoded text
 * (`Söderblomstraat`) turns into invalid UTF-8 and is left alone; only text
 * that really went through a latin1 connection survives the strict decode.
 */

/** cp1252 code points 0x80–0x9F that differ from ISO-8859-1. */
const CP1252_TO_BYTE: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

const MAX_LEVELS = 6;
const NON_ASCII = /[^\x00-\x7F]/;
const strictUtf8 = new TextDecoder("utf-8", { fatal: true });

/** One decoding pass; null when the string is not a cp1252 rendering of valid UTF-8. */
function decodeOnce(value: string): string | null {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0xff) {
      // ASCII, latin-1, and the 0x80–0x9F control range MySQL passes through
      bytes[i] = code;
    } else if (CP1252_TO_BYTE[code] !== undefined) {
      bytes[i] = CP1252_TO_BYTE[code];
    } else {
      return null;
    }
  }
  try {
    return strictUtf8.decode(bytes);
  } catch {
    return null;
  }
}

export interface RepairResult {
  value: string;
  /** How many encoding layers were removed; 0 means the input was already fine. */
  levels: number;
}

export function repairDoubleEncodedUtf8(value: string): RepairResult {
  let current = value;
  let levels = 0;
  while (levels < MAX_LEVELS && NON_ASCII.test(current)) {
    const next = decodeOnce(current);
    if (next === null || next === current) break;
    current = next;
    levels++;
  }
  return { value: current, levels };
}
