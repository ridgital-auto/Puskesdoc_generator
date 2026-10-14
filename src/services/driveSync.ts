/**
 * driveSync.ts — Sinkronisasi otomatis cadangan aplikasi ke Google Drive.
 *
 * Cara kerja: setiap ada perubahan data penting (dokumen, profil, variabel,
 * database), modul ini menjadwalkan pencadangan ke Drive (debounce 2 menit)
 * bila "Sinkronisasi Otomatis" aktif dan token Drive tersedia.
 */
import {
  exportBackupJSON,
  getStoredUserAccount,
  saveUserAccount,
} from '../utils/storage';
import { ensureDriveToken } from './googleDriveAuth';
import { saveAppBackupToGoogleDrive } from './googleDrive';

const LAST_SYNC_KEY = 'puskesdoc_last_drive_sync';
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function isAutoSyncEnabled(): boolean {
  try {
    return !!getStoredUserAccount().autoSyncGDrive;
  } catch {
    return false;
  }
}

export function setAutoSyncEnabled(v: boolean): void {
  const acc = getStoredUserAccount();
  saveUserAccount({ ...acc, autoSyncGDrive: v });
}

export function getLastSyncAt(): string | null {
  try {
    return localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

/** Cadangkan sekarang ke Google Drive. Return false bila Drive belum terhubung. */
export async function backupToDriveNow(): Promise<boolean> {
  const token = await ensureDriveToken();
  if (!token) return false;
  const res = await saveAppBackupToGoogleDrive(token, exportBackupJSON());
  if (res && res.success) {
    try {
      localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    } catch { /* abaikan */ }
    return true;
  }
  return false;
}

/**
 * Dipanggil setiap ada perubahan data. Backup dijalankan paling cepat
 * 2 menit sekali agar tidak membanjiri Drive.
 */
export function scheduleAutoBackup(): void {
  if (!isAutoSyncEnabled()) return;
  if (debounceTimer) return;
  debounceTimer = setTimeout(async () => {
    debounceTimer = null;
    try {
      await backupToDriveNow();
    } catch {
      /* gagal diam-diam; coba lagi saat ada perubahan berikutnya */
    }
  }, 120000);
}
