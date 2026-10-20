import React from 'react';
import { 
  FileText, 
  BookOpen,
  Variable,
  Folder,
  Database,
  Building2,
  Cloud,
  Mail,
  UserCheck,
  HelpCircle
} from 'lucide-react';
import { UserAccount } from '../utils/storage';

export type MainNavTab = 'generator' | 'templates' | 'variables' | 'database' | 'media' | 'profile';

interface NavbarProps {
  activeTab: MainNavTab;
  setActiveTab: (tab: MainNavTab) => void;
  onOpenCloudModal: () => void;
  onOpenLoginModal: () => void;
  onOpenHelpModal: () => void;
  userAccount: UserAccount;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenCloudModal,
  onOpenLoginModal,
  onOpenHelpModal,
  userAccount,
}) => {
  return (
    <header className="sticky top-0 z-30 holo-card border-b border-slate-200/80 px-4 lg:px-8 py-2.5 transition-all no-print">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand Zone */}
        <div className="flex items-center gap-3 shrink-0">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="Logo Puskesdoc"
            className="w-9 h-9 rounded-xl shadow-md shadow-emerald-500/20"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight bg-gradient-to-r from-slate-900 via-purple-900 to-slate-800 bg-clip-text text-transparent">
                Puskesdoc Generator
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.2 rounded-full bg-purple-100/80 text-purple-700 border border-purple-200">
                ILP 2026
              </span>
              <span className="text-[9px] font-mono text-slate-400" title="Versi build aplikasi">
                v20okt-c
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-normal">Tata Naskah Akreditasi Puskesmas</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 shadow-inner">
          <button
            onClick={() => setActiveTab('generator')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'generator'
                ? 'bg-white text-purple-700 shadow-xs border border-purple-100'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Generator Dokumen
          </button>

          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'templates'
                ? 'bg-white text-purple-700 shadow-xs border border-purple-100'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Pustaka Template
          </button>

          <button
            onClick={() => setActiveTab('variables')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'variables'
                ? 'bg-white text-purple-700 shadow-xs border border-purple-100'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Variable className="w-3.5 h-3.5" />
            Variabel
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'database'
                ? 'bg-white text-teal-700 shadow-xs border border-teal-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-teal-600" />
            Database Puskesmas
          </button>

          <button
            onClick={() => setActiveTab('media')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'media'
                ? 'bg-white text-purple-700 shadow-xs border border-purple-100'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            Pustaka Media
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-white text-purple-700 shadow-xs border border-purple-100'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Profil Faskes & KOP
          </button>
        </nav>

        {/* Action Controls: Login Email & GDrive Backup */}
        <div className="flex items-center gap-2 shrink-0">
          {/* User Account / Email Login Status */}
          {userAccount.isLoggedIn && userAccount.email ? (
            <button
              onClick={onOpenLoginModal}
              title="Klik untuk melihat status sinkronisasi akun & Google Drive"
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 hover:border-teal-300 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="max-w-[130px] sm:max-w-[180px] truncate font-mono text-[11px] text-slate-700">
                {userAccount.email}
              </span>
              <UserCheck className="w-3.5 h-3.5 text-teal-600 hidden sm:inline" />
            </button>
          ) : (
            <button
              onClick={onOpenLoginModal}
              title="Masuk dengan email & otomatis sinkronkan data ke Google Drive"
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-600 hover:from-purple-700 hover:to-teal-700 rounded-xl shadow-sm shadow-purple-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Login Email</span>
            </button>
          )}

          {/* Help Button */}
          <button
            onClick={onOpenHelpModal}
            title="Bantuan & panduan penggunaan aplikasi"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-all hover:border-purple-300 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">Bantuan</span>
          </button>

          {/* Backup & Google Drive Button */}
          <button
            onClick={onOpenCloudModal}
            title="Google Drive Backup & Ekspor JSON"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-all hover:border-purple-300 cursor-pointer"
          >
            <Cloud className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden sm:inline">Backup & GDrive</span>
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Tab Strip */}
      <div className="flex lg:hidden overflow-x-auto gap-1 pt-2 pb-1 border-t border-slate-200/50 mt-2">
        <button
          onClick={() => setActiveTab('generator')}
          className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap cursor-pointer ${
            activeTab === 'generator' ? 'bg-purple-600 text-white font-medium' : 'text-slate-600'
          }`}
        >
          Generator
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap cursor-pointer ${
            activeTab === 'templates' ? 'bg-purple-600 text-white font-medium' : 'text-slate-600'
          }`}
        >
          Pustaka Template
        </button>
        <button
          onClick={() => setActiveTab('variables')}
          className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap cursor-pointer ${
            activeTab === 'variables' ? 'bg-purple-600 text-white font-medium' : 'text-slate-600'
          }`}
        >
          Variabel
        </button>
        <button
          onClick={() => setActiveTab('database')}
          className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap cursor-pointer ${
            activeTab === 'database' ? 'bg-teal-600 text-white font-medium' : 'text-slate-600'
          }`}
        >
          Database Puskesmas
        </button>
        <button
          onClick={() => setActiveTab('media')}
          className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap cursor-pointer ${
            activeTab === 'media' ? 'bg-purple-600 text-white font-medium' : 'text-slate-600'
          }`}
        >
          Pustaka Media
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap cursor-pointer ${
            activeTab === 'profile' ? 'bg-purple-600 text-white font-medium' : 'text-slate-600'
          }`}
        >
          Profil Faskes
        </button>
      </div>
    </header>
  );
};
