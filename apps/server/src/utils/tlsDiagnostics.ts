import { X509Certificate } from 'crypto';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

type TlsDiagnosticsInput = {
  cert: Buffer;
  certPath: string;
};

export type TlsDiagnosticsStatus = {
  enabled: boolean;
  expiresAt: string | null;
  daysLeft: number | null;
};

const extractSubjectValue = (subject: string, key: string) => {
  const match = subject.match(new RegExp(`(?:^|,\\s*)${key}=([^,]+)`));
  return match?.[1]?.trim() || null;
};

const parseSubjectAltNames = (subjectAltName?: string) => {
  if (!subjectAltName) return [];
  return subjectAltName
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [label, value] = entry.split(':').map((part) => part.trim());
      return value ?? label;
    });
};

export const runTlsDiagnostics = (input: TlsDiagnosticsInput, allowExpired: boolean): TlsDiagnosticsStatus => {
  const cert = new X509Certificate(input.cert);
  const commonName = extractSubjectValue(cert.subject, 'CN');
  const subjectAltNames = parseSubjectAltNames(cert.subjectAltName);
  const expiresAtDate = new Date(cert.validTo);
  const hasValidExpiry = Number.isFinite(expiresAtDate.getTime());
  const expiresAt = hasValidExpiry ? expiresAtDate.toISOString() : null;
  const daysLeft = hasValidExpiry ? Math.ceil((expiresAtDate.getTime() - Date.now()) / MS_PER_DAY) : null;

  console.log('🔍 TLS certificate diagnostics');
  console.log(`   - Certificate: ${input.certPath}`);
  if (commonName) {
    console.log(`   - Common Name: ${commonName}`);
  }
  if (subjectAltNames.length) {
    console.log(`   - Subject Alt Names: ${subjectAltNames.join(', ')}`);
  }
  if (expiresAt) {
    console.log(`   - Expires At: ${expiresAt}`);
  } else {
    console.warn('   - Expires At: unavailable');
  }
  if (daysLeft !== null) {
    console.log(`   - Days Remaining: ${daysLeft}`);
  }

  if (hasValidExpiry && expiresAtDate.getTime() <= Date.now()) {
    const message = `TLS certificate expired on ${expiresAtDate.toISOString()}.`;
    if (allowExpired) {
      console.warn(`⚠️ ${message} ALLOW_EXPIRED_TLS=1 is set; continuing startup.`);
    } else {
      throw new Error(`${message} Set ALLOW_EXPIRED_TLS=1 to override.`);
    }
  }

  return {
    enabled: true,
    expiresAt,
    daysLeft,
  };
};
