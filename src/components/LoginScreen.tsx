import React, { useState } from 'react';
import { Loader2, ShieldCheck, Cloud, Sparkles, FileText, AlertCircle } from 'lucide-react';
import {
  getStoredUserAccount,
  saveUserAccount,
  importBackupJSON,
} from '../utils/storage';
import {
  connectDriveInteractive,
  getDriveUserEmail,
} from '../services/googleDriveAuth';
import { loadLatestBackupFromGoogleDrive } from '../services/googleDrive';
import { setAutoSyncEnabled } from '../services/driveSync';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

/**
 * Gerbang login aplikasi: tampil sebelum generator.
 * Alur: Masuk dengan Google → setujui izin → otomatis cari & pulihkan
 * cadangan dari Drive → Auto-Sync aktif → masuk ke aplikasi.
 */
export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const token = await connectDriveInteractive();
      const email = await getDriveUserEmail(token);

      const updated = {
        ...getStoredUserAccount(),
        email: email || '',
        name: (email || 'pengguna').split('@')[0],
        isLoggedIn: true,
        lastLoginAt: new Date().toISOString(),
      };
      saveUserAccount(updated);

      // Cari cadangan di Drive & pulihkan otomatis
      try {
        const backupStr = await loadLatestBackupFromGoogleDrive(token);
        if (backupStr) importBackupJSON(backupStr);
      } catch {
        /* lanjut tanpa restore */
      }

      setAutoSyncEnabled(true);
      onLoginSuccess();
    } catch (err: any) {
      setError(err?.message || 'Gagal masuk. Coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-700 via-indigo-700 to-teal-700">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-8 pb-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg mb-4">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Puskesdoc Generator</h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Penyusun dokumen akreditasi Puskesmas<br />(SOP, SK, KAK, Pedoman, Panduan)
          </p>
        </div>

        {/* Body */}
        <div className="px-8 pb-6 space-y-4">
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>Satu klik masuk dengan akun Google-mu</span>
            </div>
            <div className="flex items-start gap-2">
              <Cloud className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <span>Cadangan di Drive otomatis ditemukan & dipulihkan</span>
            </div>
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <span>Data tersinkron otomatis di semua perangkatmu</span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl text-xs bg-rose-50 border border-rose-200 text-rose-800 leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-sm transition-all disabled:opacity-60 cursor-pointer"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            )}
            <span>{isProcessing ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
          </button>

          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            Dengan masuk, Anda menyetujui{' '}
            <a href="terms.html" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">Syarat Layanan</a>
            {' '}dan{' '}
            <a href="privacy.html" target="_blank" rel="noreferrer" className="underline hover:text-slate-600">Kebijakan Privasi</a>.
          </p>
        </div>
      </div>
    </div>
  );
};
