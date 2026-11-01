// Genera SQL + credenciales para resetear/deshabilitar el MFA del superadmin.
// Uso interno desde scripts/platform-mfa.ps1. No imprime secretos por stdout
// salvo el JSON que el operador necesita guardar.
const crypto = require('crypto');

const action = (process.argv[2] || 'status').toLowerCase();
const email = (process.argv[3] || 'superadmin@unisaas.com').trim().toLowerCase();
const escape = (value) => String(value).replace(/'/g, "''");
const base32 = (buffer) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
};

if (action === 'disable') {
  console.log(JSON.stringify({
    sql: `UPDATE platform_admins SET mfa_enabled = false, updated_at = now() WHERE lower(email) = '${escape(email)}';`,
    message: 'MFA deshabilitado. El login solo pedira contrasena.',
  }));
  process.exit(0);
}

if (action === 'enable') {
  console.log(JSON.stringify({
    sql: `UPDATE platform_admins SET mfa_enabled = true, updated_at = now() WHERE lower(email) = '${escape(email)}' AND mfa_secret IS NOT NULL;`,
    message: 'MFA habilitado con el secreto existente.',
  }));
  process.exit(0);
}

const secret = base32(crypto.randomBytes(20));
const codes = [];
for (let index = 0; index < 10; index += 1) {
  const raw = crypto
    .randomBytes(9)
    .toString('base64url')
    .toUpperCase()
    .replace(/[-_]/g, '')
    .slice(0, 12)
    .match(/.{1,4}/g)
    .join('-');
  codes.push(raw);
}
const hashes = codes.map((code) =>
  crypto.createHash('sha256').update(code).digest('hex'),
);
const uri = `otpauth://totp/UNISAAS:${encodeURIComponent(email)}?secret=${secret}&issuer=UNISAAS&algorithm=SHA1&digits=6&period=30`;
const sql = [
  `UPDATE platform_admins SET mfa_secret = '${escape(secret)}', mfa_enabled = true, updated_at = now() WHERE lower(email) = '${escape(email)}';`,
  `SELECT platform_store_recovery_codes((SELECT id FROM platform_admins WHERE lower(email) = '${escape(email)}'), ARRAY[${hashes.map((hash) => `'${hash}'`).join(',')}]);`,
].join('\n');

console.log(JSON.stringify({ action: 'reset', email, secret, uri, codes, sql, message: 'MFA regenerado.' }));
