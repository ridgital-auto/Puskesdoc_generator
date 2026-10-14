/**
 * googleDriveAuth.ts — Autentikasi Google Drive via Google Identity Services (GIS).
 *
 * Alur baru (Okt 2026): aplikasi memakai SATU OAuth Client ID bersama yang
 * ditanam di kode, sehingga pengguna cukup klik "Masuk dengan Google" lalu
 * centang setuju — tanpa perlu membuat Client ID sendiri. Client ID ini
 * adalah identifier publik (bukan rahasia), aman dipasang di kode client-side.
 */
import { getGoogleClientId } from '../utils/storage';

declare global {
  interface Window {
    google?: any;
  }
}

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** OAuth Client ID bersama (milik pengelola aplikasi). */
export const DEFAULT_GOOGLE_CLIENT_ID =
  '909196579559-egqlen997lr6a1jp9nrt0dagqvslksa9.apps.googleusercontent.com';

/** Client ID efektif: setelan pengguna (lanjutan) atau bawaan aplikasi. */
export function resolveGoogleClientId(): string {
  const custom = (getGoogleClientId() || '').trim();
  return custom || DEFAULT_GOOGLE_CLIENT_ID;
}

let tokenClient: any = null;
let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let gisLoadPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Tidak ada window.'));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoadPromise = null;
      reject(new Error('Gagal memuat Google Identity Services. Periksa koneksi internet lalu coba lagi.'));
    };
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

function ensureTokenClient(): void {
  const clientId = resolveGoogleClientId();
  if (!tokenClient || tokenClient.__clientId !== clientId) {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: () => {},
    });
    tokenClient.__clientId = clientId;
  }
}

function requestToken(promptMode: '' | 'consent'): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (token: string | null) => {
      if (settled) return;
      settled = true;
      resolve(token);
    };
    tokenClient.callback = (resp: any) => {
      if (resp && resp.access_token) {
        cachedToken = resp.access_token;
        tokenExpiresAt = Date.now() + (Number(resp.expires_in) || 3600) * 1000 - 60_000;
        done(cachedToken);
      } else {
        done(null);
      }
    };
    try {
      tokenClient.requestAccessToken({ prompt: promptMode });
    } catch {
      done(null);
    }
    // Pengaman: jangan gantung selamanya
    setTimeout(() => {
      if (!settled) {
        if (cachedToken && tokenExpiresAt > Date.now()) done(cachedToken);
        else done(null);
      }
    }, 10000);
  });
}

/** Minta token Drive diam-diam (tanpa popup) bila sesi Google masih valid. */
export async function getDriveTokenSilent(): Promise<string | null> {
  try {
    if (cachedToken && tokenExpiresAt > Date.now()) return cachedToken;
    await loadGisScript();
    ensureTokenClient();
    return await requestToken('');
  } catch {
    return null;
  }
}

/** Hubungkan Drive secara interaktif (popup persetujuan Google). */
export async function connectDriveInteractive(): Promise<string> {
  await loadGisScript();
  ensureTokenClient();
  const token = await requestToken('consent');
  if (!token) {
    throw new Error('Koneksi Google Drive dibatalkan atau ditolak. Coba lagi dan klik "Izinkan" pada popup Google.');
  }
  return token;
}

/** Token siap pakai: cache → diam-diam → null (perlu klik Hubungkan). */
export async function ensureDriveToken(): Promise<string | null> {
  if (cachedToken && tokenExpiresAt > Date.now()) return cachedToken;
  return getDriveTokenSilent();
}

export function clearDriveToken(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}

export function hasGoogleClientId(): boolean {
  return !!resolveGoogleClientId();
}

/** Ambil email akun Google dari token Drive (via Drive about API). */
export async function getDriveUserEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.user?.emailAddress || null;
  } catch {
    return null;
  }
}
