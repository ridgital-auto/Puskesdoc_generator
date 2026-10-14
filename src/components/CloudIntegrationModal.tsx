import React, { useState, useEffect } from 'react';
import { 
  X, 
  Cloud, 
  Download, 
  Upload, 
  Cpu, 
  Check, 
  HardDrive,
  RefreshCw,
  FolderOpen,
  Trash2,
  FileText,
  LogIn,
  LogOut,
  ShieldCheck,
  AlertCircle,
  KeyRound
} from 'lucide-react';
import { 
  getStoredGDriveSettings, 
  saveGDriveSettings, 
  GDriveSettings, 
  getStoredAgentConfig, 
  saveAgentConfig, 
  getGeminiApiKey,
  saveGeminiApiKey,
  getGoogleClientId,
  saveGoogleClientId,
  exportBackupJSON, 
  importBackupJSON,
  getStoredUserAccount,
  saveUserAccount,
  logoutUserAccount
} from '../utils/storage';
import { CustomAgentConfig, PuskesDoc, FaskesProfile } from '../types';
import { 
  googleSignIn, 
  logout as googleLogout
} from '../services/googleAuth';
import { 
  listGoogleDriveDocs, 
  saveDocToGoogleDrive, 
  loadDocFromGoogleDrive, 
  deleteDocFromGoogleDrive,
  saveAppBackupToGoogleDrive,
  loadLatestBackupFromGoogleDrive,
  DriveFileItem 
} from '../services/googleDrive';
import {
  connectDriveInteractive,
  ensureDriveToken,
  clearDriveToken,
  getDriveUserEmail,
  resolveGoogleClientId,
  DEFAULT_GOOGLE_CLIENT_ID,
} from '../services/googleDriveAuth';
import {
  isAutoSyncEnabled,
  setAutoSyncEnabled,
  getLastSyncAt,
} from '../services/driveSync';

interface CloudIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored: () => void;
  currentDoc?: PuskesDoc;
  profile?: FaskesProfile;
  onLoadDocFromCloud?: (doc: PuskesDoc) => void;
}

export const CloudIntegrationModal: React.FC<CloudIntegrationModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
  currentDoc,
  profile,
  onLoadDocFromCloud,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'gdrive' | 'backup' | 'agent'>('gdrive');
  const [agentConfig, setAgentConfig] = useState<CustomAgentConfig>(getStoredAgentConfig());
  
  // Auth state
  const [userAccount, setUserAccount] = useState(getStoredUserAccount());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Drive state
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingDriveFiles, setIsLoadingDriveFiles] = useState(false);
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [isSyncingBackup, setIsSyncingBackup] = useState(false);

  // Agent state
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [geminiKey, setGeminiKey] = useState(getGeminiApiKey());
  const [googleClientId, setGoogleClientId] = useState(getGoogleClientId());
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [showClientIdGuide, setShowClientIdGuide] = useState(false);
  const [autoSync, setAutoSync] = useState(isAutoSyncEnabled());
  const [lastSync, setLastSync] = useState<string | null>(getLastSyncAt());
  const [saveNotification, setSaveNotification] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUserAccount(getStoredUserAccount());
      setGoogleClientId(getGoogleClientId());
      // Coba ambil token Drive diam-diam (tanpa popup) bila sesi Google masih valid
      ensureDriveToken().then((token) => {
        setAccessToken(token);
        if (token) {
          loadDriveFiles(token);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const triggerNotice = (msg: string) => {
    setSaveNotification(msg);
    setTimeout(() => setSaveNotification(null), 3500);
  };

  /** Token Drive yang masih berlaku (refresh diam-diam bila perlu). */
  const getValidDriveToken = async (): Promise<string | null> => {
    const token = await ensureDriveToken();
    setAccessToken(token);
    return token;
  };

  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    try {
      const token = await connectDriveInteractive();
      setAccessToken(token);

      // Catat email akun Google yang login
      const email = await getDriveUserEmail(token);
      if (email) {
        const updated = {
          ...getStoredUserAccount(),
          email,
          name: email.split('@')[0],
          isLoggedIn: true,
          lastLoginAt: new Date().toISOString(),
        };
        saveUserAccount(updated);
        setUserAccount(updated);
      }

      // Cari cadangan otomatis di Drive → pulihkan bila ada
      let restored = false;
      try {
        const backupStr = await loadLatestBackupFromGoogleDrive(token);
        if (backupStr && importBackupJSON(backupStr)) {
          onDataRestored();
          restored = true;
        }
      } catch { /* abaikan, lanjut tanpa restore */ }

      // Aktifkan sinkronisasi otomatis
      setAutoSyncEnabled(true);
      setAutoSync(true);

      triggerNotice(
        restored
          ? `Masuk sebagai ${email || 'akun Google'}. Cadangan Drive ditemukan & dipulihkan otomatis. Auto-Sync aktif.`
          : `Masuk sebagai ${email || 'akun Google'}. Belum ada cadangan di Drive — data perangkat ini akan dicadangkan otomatis.`
      );
      loadDriveFiles(token);
    } catch (err: any) {
      alert(`Gagal menautkan Google Drive: ${err.message}`);
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleDisconnectDrive = () => {
    clearDriveToken();
    setAccessToken(null);
    setDriveFiles([]);
    triggerNotice('Koneksi Google Drive diputus.');
  };

  /** Login akun pengguna via Firebase (untuk identitas, terpisah dari Drive). */
  const handleUserGoogleSignIn = async () => {
    setIsAuthenticating(true);
    try {
      const res = await googleSignIn();
      if (res && res.user) {
        const email = res.user.email || 'user@faskes.id';
        const updated = {
          email,
          name: res.user.displayName || email.split('@')[0],
          isLoggedIn: true,
          lastLoginAt: new Date().toISOString(),
          autoSyncGDrive: true,
        };
        saveUserAccount(updated);
        setUserAccount(updated);
        triggerNotice(`Berhasil masuk dengan akun Google: ${email}`);
      }
    } catch (err: any) {
      alert(`Gagal login Google: ${err.message}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    await googleLogout();
    logoutUserAccount();
    clearDriveToken();
    setUserAccount({ email: '', isLoggedIn: false });
    setAccessToken(null);
    setDriveFiles([]);
    triggerNotice('Berhasil keluar dari akun Google.');
  };

  const loadDriveFiles = async (token?: string) => {
    const t = token || (await getValidDriveToken());
    if (!t) return;
    setIsLoadingDriveFiles(true);
    try {
      const files = await listGoogleDriveDocs(t);
      setDriveFiles(files);
    } catch (err: any) {
      console.error('Failed listing drive docs', err);
    } finally {
      setIsLoadingDriveFiles(false);
    }
  };

  // Save current active document to Google Drive
  const handleSaveCurrentDocToDrive = async () => {
    const token = await getValidDriveToken();
    if (!token) {
      alert('Hubungkan Google Drive terlebih dahulu.');
      return;
    }
    if (!currentDoc) {
      alert('Tidak ada dokumen yang sedang aktif.');
      return;
    }
    setIsSavingToDrive(true);
    try {
      const res = await saveDocToGoogleDrive(token, currentDoc);
      if (res.success) {
        triggerNotice(`Dokumen "${res.fileName}" berhasil disimpan di Google Drive!`);
        loadDriveFiles(token);
      }
    } catch (err: any) {
      alert(`Gagal menyimpan ke Google Drive: ${err.message}`);
    } finally {
      setIsSavingToDrive(false);
    }
  };

  // Save Full App Backup to Google Drive
  const handleSaveAppBackupToDrive = async () => {
    const token = await getValidDriveToken();
    if (!token) {
      alert('Hubungkan Google Drive terlebih dahulu.');
      return;
    }
    setIsSyncingBackup(true);
    try {
      const backupStr = exportBackupJSON();
      const res = await saveAppBackupToGoogleDrive(token, backupStr);
      if (res.success) {
        triggerNotice('Cadangan lengkap data Puskesmas berhasil disimpan di Google Drive!');
        setLastSync(getLastSyncAt());
        loadDriveFiles(token);
      }
    } catch (err: any) {
      alert(`Gagal mencadangkan ke Google Drive: ${err.message}`);
    } finally {
      setIsSyncingBackup(false);
    }
  };

  // Restore Full App Backup from Google Drive
  const handleRestoreBackupFromDrive = async () => {
    const token = await getValidDriveToken();
    if (!token) {
      alert('Hubungkan Google Drive terlebih dahulu.');
      return;
    }
    setIsSyncingBackup(true);
    try {
      const backupStr = await loadLatestBackupFromGoogleDrive(token);
      if (!backupStr) {
        alert('Tidak ditemukan berkas cadangan "puskesdoc_full_backup.json" di Google Drive.');
        return;
      }
      const success = importBackupJSON(backupStr);
      if (success) {
        onDataRestored();
        triggerNotice('Data aplikasi berhasil dipulihkan dari cadangan Google Drive!');
      } else {
        alert('Format berkas cadangan di Google Drive tidak valid.');
      }
    } catch (err: any) {
      alert(`Gagal memulihkan dari Google Drive: ${err.message}`);
    } finally {
      setIsSyncingBackup(false);
    }
  };

  // Load document from Drive
  const handleImportDocFromDrive = async (fileId: string) => {
    const token = await getValidDriveToken();
    if (!token) return;
    try {
      const doc = await loadDocFromGoogleDrive(token, fileId);
      if (doc && onLoadDocFromCloud) {
        onLoadDocFromCloud(doc);
        triggerNotice(`Dokumen "${doc.title}" berhasil dimuat ke editor!`);
        onClose();
      }
    } catch (err: any) {
      alert(`Gagal memuat file dari Drive: ${err.message}`);
    }
  };

  // Delete document from Drive
  const handleDeleteDocFromDrive = async (fileId: string, fileName: string) => {
    const token = await getValidDriveToken();
    if (!token) return;
    try {
      const ok = await deleteDocFromGoogleDrive(token, fileId, fileName);
      if (ok) {
        triggerNotice(`Dokumen "${fileName}" telah dihapus dari Google Drive`);
        loadDriveFiles(token);
      }
    } catch (err: any) {
      alert(`Gagal menghapus file: ${err.message}`);
    }
  };

  // Manual Export JSON
  const handleExportBackup = () => {
    const jsonStr = exportBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `puskesdoc_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    triggerNotice('File cadangan lokal (.json) berhasil diunduh!');
  };

  // Manual Import JSON
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const success = importBackupJSON(text);
        if (success) {
          onDataRestored();
          triggerNotice('Data aplikasi berhasil dipulihkan dari berkas JSON!');
        } else {
          alert('Format berkas JSON cadangan tidak valid.');
        }
      } catch (err) {
        alert('Gagal membaca berkas cadangan JSON.');
      }
    };
    reader.readAsText(file);
  };

  // Custom Agent Test
  const handleTestAgent = async () => {
    if ((!agentConfig.apiKey && !agentConfig.noKey) || !agentConfig.endpoint) {
      setTestStatus('Harap isi Endpoint' + (agentConfig.noKey ? '' : ' dan API Key') + ' terlebih dahulu.');
      return;
    }
    setIsTesting(true);
    setTestStatus(null);
    try {
      const res = await fetch(agentConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${agentConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: agentConfig.model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Halo, respon kata OK jika terhubung.' }],
          max_tokens: 10,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestStatus('Uji koneksi AI Agent berhasil terhubung!');
      } else {
        setTestStatus(`Gagal terhubung (${res.status}): ${data.error?.message || 'Error endpoint'}`);
      }
    } catch (err: any) {
      setTestStatus(`Koneksi error: ${err.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-purple-700 via-indigo-700 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Sinkronisasi Google Drive & Cadangan</h2>
              <p className="text-xs text-purple-100">
                Penyimpanan cadangan terpusat faskes & ekspor/impor berkas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Auth Banner */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {userAccount.isLoggedIn && userAccount.email ? (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
                  {userAccount.email.charAt(0)}
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-800">{userAccount.email}</span>
                  <span className="text-[10px] text-emerald-600 font-medium block">Akun Aktif & Siap Sinkronisasi</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-600">
                <span>Belum masuk akun Google. Masuk untuk sinkronisasi Google Drive.</span>
              </div>
            )}
          </div>

          <div>
            {userAccount.isLoggedIn && userAccount.email ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Keluar
              </button>
            ) : (
              <button
                onClick={handleUserGoogleSignIn}
                disabled={isAuthenticating}
                className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs transition-all hover:border-purple-300 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                {isAuthenticating ? 'Menghubungkan...' : 'Sign in with Google'}
              </button>
            )}
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-100 bg-slate-50/50">
          <button
            onClick={() => setActiveSubTab('gdrive')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'gdrive'
                ? 'border-purple-600 text-purple-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Google Drive Faskes
          </button>
          <button
            onClick={() => setActiveSubTab('backup')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'backup'
                ? 'border-purple-600 text-purple-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Backup Manual (.json)
          </button>
          <button
            onClick={() => setActiveSubTab('agent')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'agent'
                ? 'border-purple-600 text-purple-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Pengaturan Custom AI
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          {saveNotification && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-fade-in">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{saveNotification}</span>
            </div>
          )}

          {/* SubTab 1: Google Drive */}
          {activeSubTab === 'gdrive' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <HardDrive className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-600 leading-relaxed">
                    <span className="font-bold text-slate-800">Folder Google Drive Resmi Faskes</span>
                    <p className="mt-0.5">
                      Target Folder: <code className="font-mono text-purple-700 font-bold bg-white px-1.5 py-0.5 rounded border border-purple-200">Akreditasi Puskesmas ILP 2026</code>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {accessToken && (
                    <>
                      <button
                        onClick={handleSaveAppBackupToDrive}
                        disabled={isSyncingBackup}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg shadow-xs transition-all cursor-pointer"
                        title="Cadangkan seluruh data Puskesmas (profil, variabel, database, template) ke Google Drive"
                      >
                        {isSyncingBackup ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                        Cadangkan ke Drive
                      </button>

                      <label
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg cursor-pointer"
                        title="Otomatis cadangkan ke Drive setiap ada perubahan data (maks. 1x per 2 menit)"
                      >
                        <input
                          type="checkbox"
                          checked={autoSync}
                          onChange={(e) => {
                            setAutoSyncEnabled(e.target.checked);
                            setAutoSync(e.target.checked);
                            triggerNotice(e.target.checked ? 'Sinkronisasi otomatis AKTIF.' : 'Sinkronisasi otomatis MATI.');
                          }}
                          className="w-3.5 h-3.5 accent-teal-600"
                        />
                        Auto-Sync
                        {lastSync && (
                          <span className="font-normal text-slate-400">
                            ({new Date(lastSync).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})
                          </span>
                        )}
                      </label>

                      <button
                        onClick={handleRestoreBackupFromDrive}
                        disabled={isSyncingBackup}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-300 disabled:opacity-50 rounded-lg shadow-xs transition-all cursor-pointer"
                        title="Pulihkan data aplikasi dari cadangan Google Drive"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingBackup ? 'animate-spin' : ''}`} />
                        Sinkronkan dari Drive
                      </button>
                    </>
                  )}

                  {accessToken && currentDoc && (
                    <button
                      onClick={handleSaveCurrentDocToDrive}
                      disabled={isSavingToDrive}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg shadow-xs transition-all cursor-pointer"
                    >
                      {isSavingToDrive ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
                      Simpan Dokumen Aktif
                    </button>
                  )}
                </div>
              </div>

              {!accessToken ? (
                <div className="space-y-3">
                  <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl bg-gradient-to-b from-purple-50/60 to-white space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center">
                      <svg className="w-6 h-6" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Masuk dengan Google</h4>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                        Satu klik: pilih akun Google-mu, centang setuju.<br />
                        Aplikasi otomatis mencari cadangan di Drive-mu lalu memulihkan &amp; mengaktifkan sinkronisasi otomatis.
                      </p>
                    </div>
                    <button
                      onClick={handleConnectDrive}
                      disabled={isConnectingDrive}
                      className="px-6 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl shadow-sm cursor-pointer"
                    >
                      {isConnectingDrive ? 'Menghubungkan...' : 'Masuk dengan Google'}
                    </button>
                  </div>

                  {/* Pengaturan lanjutan: Client ID kustom */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <button
                      onClick={() => setShowClientIdGuide(!showClientIdGuide)}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:underline cursor-pointer"
                    >
                      {showClientIdGuide ? '▾ Sembunyikan pengaturan lanjutan' : '▸ Pengaturan lanjutan (Client ID kustom)'}
                    </button>
                    {showClientIdGuide && (
                      <div className="mt-2 space-y-2">
                        <p className="text-[10px] text-slate-400">
                          Normalnya tidak perlu diubah — aplikasi memakai Client ID bawaan. Isi di bawah hanya bila ingin memakai Client ID sendiri.
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={googleClientId}
                            onChange={(e) => setGoogleClientId(e.target.value)}
                            placeholder={DEFAULT_GOOGLE_CLIENT_ID}
                            className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                          />
                          <button
                            onClick={() => {
                              saveGoogleClientId(googleClientId);
                              triggerNotice(googleClientId.trim() ? 'Client ID kustom disimpan!' : 'Kembali memakai Client ID bawaan.');
                            }}
                            className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm cursor-pointer shrink-0"
                          >
                            Simpan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-purple-600" />
                      Daftar Dokumen Tersimpan di Google Drive ({driveFiles.length})
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleDisconnectDrive}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Putuskan koneksi Google Drive"
                      >
                        Putuskan
                      </button>
                    <button
                      onClick={() => loadDriveFiles()}
                      disabled={isLoadingDriveFiles}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-purple-600 bg-slate-100 rounded-lg cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingDriveFiles ? 'animate-spin' : ''}`} />
                      Segarkan
                    </button>
                    </div>
                  </div>

                  {isLoadingDriveFiles ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-600" />
                      Memuat daftar dokumen dari Google Drive...
                    </div>
                  ) : driveFiles.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                      Belum ada dokumen yang tersimpan di folder Google Drive ini.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                      {driveFiles.map((file) => (
                        <div key={file.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="min-w-0 pr-3">
                            <span className="font-semibold text-xs text-slate-800 truncate block">
                              {file.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {file.modifiedTime ? new Date(file.modifiedTime).toLocaleString('id-ID') : '-'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleImportDocFromDrive(file.id)}
                              className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer"
                            >
                              Buka Dokumen
                            </button>
                            <button
                              onClick={() => handleDeleteDocFromDrive(file.id, file.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer"
                              title="Hapus dari Google Drive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SubTab 2: Backup & Restore Manual */}
          {activeSubTab === 'backup' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                Fitur ini memungkinkan Anda mengekspor seluruh konfigurasi Puskesdoc Generator (profil faskes, logo, variabel, database capaian, riwayat dokumen, dan template) menjadi berkas cadangan JSON yang aman, atau mengimpornya kembali di perangkat mana pun.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-purple-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3">
                      <Download className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">Ekspor File Cadangan (.json)</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Unduh seluruh data profil faskes, logo, variabel, database capaian, template, dan draft dokumen.
                    </p>
                  </div>
                  <button
                    onClick={handleExportBackup}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Unduh Cadangan Lengkap
                  </button>
                </div>

                <div className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-pink-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center mb-3">
                      <Upload className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">Pulihkan dari File (.json)</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Pilih berkas cadangan JSON yang pernah Anda unduh untuk mengembalikan semua data pengaturan faskes Anda.
                    </p>
                  </div>
                  <label className="mt-4 w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    Pilih Berkas JSON
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackup}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* SubTab 3: Custom AI Agent */}
          {activeSubTab === 'agent' && (
            <div className="space-y-4">
              {/* API Key Gemini Pribadi — wajib untuk link preview / GitHub Pages */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800">API Key Gemini Pribadi (Gemini 3.8 Flash)</span>
                    <p className="text-[11px] text-slate-500">
                      Wajib diisi agar AI bisa dipakai di link preview. Key hanya tersimpan di browser ini.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    API Key Gemini
                  </label>
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    placeholder="AIza..."
                  />
                </div>
                <div className="flex items-center justify-between">
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-sky-700 hover:underline"
                  >
                    Buat API key gratis di Google AI Studio →
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      saveGeminiApiKey(geminiKey);
                      triggerNotice(geminiKey.trim() ? 'API Key Gemini berhasil disimpan!' : 'API Key Gemini dikosongkan.');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm cursor-pointer"
                  >
                    Simpan API Key
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800">Gunakan Custom AI Agent / API Pribadi</span>
                    <p className="text-[11px] text-slate-500">
                      Aktifkan jika ingin menggunakan OpenAI, Groq, OpenRouter, atau server LLM Anda sendiri.
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agentConfig.enabled}
                    onChange={(e) => setAgentConfig({ ...agentConfig, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {agentConfig.enabled && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Label Nama Provider
                    </label>
                    <input
                      type="text"
                      value={agentConfig.name}
                      onChange={(e) => setAgentConfig({ ...agentConfig, name: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      placeholder="Contoh: OpenAI / Groq / OpenRouter"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      API Endpoint URL (Kompatibel Chat Completions)
                    </label>
                    <input
                      type="text"
                      value={agentConfig.endpoint}
                      onChange={(e) => setAgentConfig({ ...agentConfig, endpoint: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      placeholder="https://api.openai.com/v1/chat/completions"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        API Key Pribadi
                      </label>
                      <input
                        type="password"
                        value={agentConfig.apiKey}
                        onChange={(e) => setAgentConfig({ ...agentConfig, apiKey: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        placeholder="sk-..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nama Model
                      </label>
                      <input
                        type="text"
                        value={agentConfig.model}
                        onChange={(e) => setAgentConfig({ ...agentConfig, model: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        placeholder="gpt-4o-mini / llama-3.3-70b-versatile"
                      />
                    </div>
                  </div>

                  {testStatus && (
                    <div className={`p-3 rounded-xl text-xs border ${
                      testStatus.includes('berhasil') ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}>
                      {testStatus}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleTestAgent}
                      disabled={isTesting || !agentConfig.apiKey}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                      {isTesting ? 'Menguji...' : 'Uji Koneksi Endpoint'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        saveAgentConfig(agentConfig);
                        triggerNotice('Konfigurasi Agent berhasil disimpan!');
                      }}
                      className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm cursor-pointer"
                    >
                      Simpan Konfigurasi Agent
                    </button>
                  </div>
                </div>
              )}

              {!agentConfig.enabled && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Mode Default Aktif:</span> Aplikasi menggunakan model resmi <strong className="text-purple-700">Google Gemini 3.8 Flash</strong> dengan API key pribadimu di atas — pemakaian tercatat di akun Google AI Studio milikmu.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
