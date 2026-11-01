import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function decodeBase32(secret: string): Buffer {
  const normalized = String(secret || '')
    .toUpperCase()
    .replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) {
      throw new Error('Secreto TOTP inválido.');
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

function hotp(secret: string, counter: number, digits = 6): string {
  const key = decodeBase32(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function verifyTotp(
  secret: string,
  token: string,
  options?: { window?: number; timestamp?: number },
): boolean {
  const cleanToken = String(token || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(cleanToken) || !secret) {
    return false;
  }

  const window = options?.window ?? 1;
  const counter = Math.floor((options?.timestamp ?? Date.now()) / 30_000);
  const expected = Buffer.from(cleanToken);

  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = Buffer.from(hotp(secret, counter + offset));
    if (
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
    ) {
      return true;
    }
  }

  return false;
}

export function generateTotp(
  secret: string,
  options?: { timestamp?: number; digits?: number },
): string {
  const counter = Math.floor((options?.timestamp ?? Date.now()) / 30_000);
  return hotp(secret, counter, options?.digits ?? 6);
}

export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  let secret = '';
  for (let i = 0; i < bytes.length; i++) {
    secret += BASE32_ALPHABET[bytes[i] % 32];
  }
  return secret;
}

export function buildTotpUri(email: string, secret: string): string {
  const label = encodeURIComponent(`UNISAAS:${email}`);
  return `otpauth://totp/${label}?secret=${encodeURIComponent(secret)}&issuer=UNISAAS&algorithm=SHA1&digits=6&period=30`;
}

export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const hex = randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${hex.slice(0, 4)}-${hex.slice(4)}`);
  }
  return codes;
}

