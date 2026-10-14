import React, { useState, useEffect } from 'react';
import { Navbar, MainNavTab } from './components/Navbar';
import { GeneratorView } from './components/GeneratorView';
import { ProfileVariablesView } from './components/ProfileVariablesView';
import { TemplateManagerView } from './components/TemplateManagerView';
import { VariablesManagerView } from './components/VariablesManagerView';
import { MediaLibraryView } from './components/MediaLibraryView';
import { DatabasePuskesmasView } from './components/DatabasePuskesmasView';
import { PromptModal } from './components/PromptModal';
import { CloudIntegrationModal } from './components/CloudIntegrationModal';
import { HelpModal } from './components/HelpModal';
import { addDataChangeListener } from './utils/storage';
import { scheduleAutoBackup } from './services/driveSync';
import { LoginModal } from './components/LoginModal';
import { LoginScreen } from './components/LoginScreen';
import { 
  getStoredProfile, 
  saveProfile, 
  getStoredVariables, 
  saveVariables, 
  getStoredCustomTypes, 
  saveCustomTypes,
  getStoredUserAccount,
  UserAccount
} from './utils/storage';
import { FaskesProfile, VariableItem, CustomDocTypeDefinition, PuskesDoc, DocumentTemplate, DocumentType, PuskesmasDatabaseItem } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<MainNavTab>('generator');
  const [userAccount, setUserAccount] = useState<UserAccount>(getStoredUserAccount());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [gateLocked, setGateLocked] = useState<boolean>(() => !getStoredUserAccount().isLoggedIn);

  // Kembali ke halaman login setiap ada logout dari mana pun
  useEffect(() => {
    const onLogout = () => setGateLocked(true);
    window.addEventListener('puskesdoc:logout', onLogout);
    return () => window.removeEventListener('puskesdoc:logout', onLogout);
  }, []);
  const [profile, setProfile] = useState<FaskesProfile>(getStoredProfile());
  const [variables, setVariables] = useState<VariableItem[]>(getStoredVariables());
  const [customTypes, setCustomTypes] = useState<CustomDocTypeDefinition[]>(getStoredCustomTypes());
  const [selectedDatabaseItems, setSelectedDatabaseItems] = useState<PuskesmasDatabaseItem[]>([]);

  // Current active document
  const [currentDoc, setCurrentDoc] = useState<PuskesDoc>({
    id: 'doc_' + Date.now(),
    title: 'Pelayanan Pemeriksaan Antenatal Care (ANC) Terpadu',
    docType: 'SOP',
    klaster: 'KLASTER_2',
    docNumber: '440/015/SOP/PKM.BBK/2026',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    useKop: true,
    sopMetadata: {
      noDokumen: '440/015/SOP/PKM.BBK/2026',
      noRevisi: '00',
      tanggalTerbit: new Date().toLocaleDateString('id-ID'),
      halaman: '1/2',
      unitTerkait: 'Klaster 2 (Ibu & Anak), Laboratorium, Farmasi',
      penanggungJawab: 'dr. H. AHMAD FAUZI, M.M.Kes',
    },
    sections: [
      {
        id: 'sec_1',
        title: '1. Pengertian',
        content: 'Pelayanan ANC Terpadu adalah pelayanan antenatal komprehensif dan terpadu berkualitas minimal 6 kali selama masa kehamilan untuk mendeteksi dini faktor risiko stunting dan komplikasi obstetrik pada sasaran ibu hamil di {{nama_puskesmas}}.',
      },
      {
        id: 'sec_2',
        title: '2. Tujuan',
        content: 'Sebagai acuan penerapan langkah-langkah bagi tenaga kesehatan (Bidan dan Dokter) dalam memberikan pelayanan antenatal care terpadu berstandar Integrasi Layanan Primer (ILP).',
      },
      {
        id: 'sec_3',
        title: '3. Kebijakan',
        content: 'Surat Keputusan Kepala {{nama_puskesmas}} Nomor {{nomor_surat_sk}} tentang Standar Pelayanan Klinis Klaster Ibu dan Anak.',
      },
      {
        id: 'sec_4',
        title: '4. Referensi',
        content: '1. Undang-Undang Nomor 17 Tahun 2023 tentang Kesehatan;\n2. Keputusan Menteri Kesehatan Republik Indonesia Nomor HK.01.07/MENKES/2015/2023 tentang Petunjuk Teknis Integrasi Pelayanan Kesehatan Primer;\n3. Buku Panduan Praktis Pelayanan Kontrasepsi dan ANC Kemenkes RI.',
      },
      {
        id: 'sec_5',
        title: '5. Prosedur / Langkah-Langkah',
        content: '1. Petugas pendaftaran menerima pasien dan mengarahkan ke ruang pelayanan Klaster 2.\n2. Bidan melakukan anamnesis terpadu, pengukuran tanda vital, berat badan, tinggi badan, LiLA, dan tinggi fundus uteri.\n3. Dokter melakukan pemeriksaan USG kehamilan (trimester 1 dan trimester 3).\n4. Petugas laboratorium melakukan skrining anemia (Hb) dan triple eliminasi (HIV, Sifilis, Hepatitis B).\n5. Bidan memberikan konseling gizi seimbang serta suplementasi tablet tambah darah.\n6. Petugas mencatat hasil pemeriksaan ke dalam Buku KIA dan sistem informasi kesehatan puskesmas.',
      },
      {
        id: 'sec_6',
        title: '6. Diagram Alir',
        content: 'Pendaftaran -> Anamnesis & TTV -> Pemeriksaan Fisik & USG Dokter -> Skrining Lab Terpadu -> Konseling & Obat -> Pencatatan Buku KIA & SIMPUS',
      },
      {
        id: 'sec_7',
        title: '7. Unit Terkait',
        content: 'Ruang KIA/KB Klaster 2, Ruang Laboratorium, Ruang Farmasi, Ruang Gizi.',
      },
      {
        id: 'sec_8',
        title: '8. Rekaman Historis Perubahan',
        content: 'No | Yang Diubah | Isi Perubahan | Tgl Diberlakukan\n1.  | Format Dokumen | Penyesuaian Format Akreditasi ILP | 2026',
      },
    ],
  });

  // Modal States
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [promptModalText, setPromptModalText] = useState('');
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // Daftarkan sinkronisasi otomatis ke Google Drive saat ada perubahan data
  useEffect(() => {
    addDataChangeListener(scheduleAutoBackup);
  }, []);

  const handleOpenPromptModal = (text: string) => {
    setPromptModalText(text);
    setIsPromptModalOpen(true);
  };

  const handleNewDoc = () => {
    setCurrentDoc({
      id: 'doc_' + Date.now(),
      title: 'Dokumen Standar Akreditasi Puskesmas',
      docType: 'SOP',
      klaster: 'KLASTER_1',
      docNumber: '440/001/SOP/PKM/2026',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      useKop: true,
      sopMetadata: {
        noDokumen: '440/001/SOP/PKM/2026',
        noRevisi: '00',
        tanggalTerbit: new Date().toLocaleDateString('id-ID'),
        halaman: '1/2',
        unitTerkait: 'Klaster 1 Manajemen',
        penanggungJawab: profile.kepalaPuskesmas,
      },
      sections: [
        { id: 'sec_1', title: '1. Pengertian', content: 'Pengertian dan batasan dokumen operasional di {{nama_puskesmas}}...' },
        { id: 'sec_2', title: '2. Tujuan', content: 'Sebagai pedoman kerja petugas...' },
        { id: 'sec_3', title: '3. Kebijakan', content: 'SK Kepala Puskesmas Nomor {{nomor_surat_sk}}...' },
        { id: 'sec_4', title: '4. Referensi', content: 'Kepmenkes Juknis ILP 2023...' },
        { id: 'sec_5', title: '5. Prosedur', content: '1. Tahap persiapan...\n2. Tahap pelaksanaan...' },
        { id: 'sec_6', title: '6. Diagram Alir', content: 'Alur kerja pelayanan...' },
        { id: 'sec_7', title: '7. Unit Terkait', content: 'Seluruh Klaster Puskesmas...' },
        { id: 'sec_8', title: '8. Rekaman Historis Perubahan', content: 'Dokumen Baru Standar ILP' },
      ],
    });
    setActiveTab('generator');
  };

  const handleApplyTemplateToGenerator = (template: DocumentTemplate) => {
    setCurrentDoc({
      ...currentDoc,
      title: template.name,
      docType: (['SOP', 'SK', 'KAK', 'PEDOMAN', 'PANDUAN'].includes(template.docType) ? template.docType : 'CUSTOM') as DocumentType,
      customTypeName: !['SOP', 'SK', 'KAK', 'PEDOMAN', 'PANDUAN'].includes(template.docType) ? template.name : undefined,
      sections: template.sections.map((s, idx) => ({
        id: s.id || `sec_tpl_${idx}`,
        title: s.title,
        content: s.content,
      })),
      useKop: template.useKopDefault ?? true,
      kopMode: template.kopMode || currentDoc.kopMode || 'manual',
      originalDocxHtml: template.originalDocxHtml,
      originalDocxBase64: template.originalDocxBase64,
    });
    setActiveTab('generator');
  };

  const handleDataRestored = () => {
    setProfile(getStoredProfile());
    setVariables(getStoredVariables());
    setCustomTypes(getStoredCustomTypes());
    setUserAccount(getStoredUserAccount());
  };

  const handleGateLogin = () => {
    handleDataRestored();
    setGateLocked(false);
  };

  // Gerbang login: tampil sebelum generator
  if (gateLocked) {
    return <LoginScreen onLoginSuccess={handleGateLogin} />;
  }

  return (
    <div className="min-h-screen holo-gradient flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCloudModal={() => setIsCloudModalOpen(true)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onOpenHelpModal={() => setIsHelpModalOpen(true)}
        userAccount={userAccount}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {activeTab === 'generator' && (
          <GeneratorView
            profile={profile}
            variables={variables}
            customTypes={customTypes}
            currentDoc={currentDoc}
            setCurrentDoc={setCurrentDoc}
            onOpenPromptModal={handleOpenPromptModal}
            onNavigateToTemplates={() => setActiveTab('templates')}
            selectedDatabaseItems={selectedDatabaseItems}
            setSelectedDatabaseItems={setSelectedDatabaseItems}
          />
        )}

        {activeTab === 'templates' && (
          <TemplateManagerView
            onApplyTemplateToGenerator={handleApplyTemplateToGenerator}
            profile={profile}
          />
        )}

        {activeTab === 'variables' && (
          <VariablesManagerView
            variables={variables}
            setVariables={setVariables}
            onSaveVariables={(v) => saveVariables(v)}
          />
        )}

        {activeTab === 'database' && (
          <DatabasePuskesmasView
            onSelectForGenerator={(item) => {
              setSelectedDatabaseItems((prev) => {
                if (prev.some((x) => x.id === item.id)) return prev;
                return [...prev, item];
              });
            }}
            onNavigateToGenerator={() => setActiveTab('generator')}
          />
        )}

        {activeTab === 'media' && (
          <MediaLibraryView
            onInsertToTemplate={() => setActiveTab('templates')}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileVariablesView
            profile={profile}
            setProfile={setProfile}
            variables={variables}
            setVariables={setVariables}
            onSaveProfile={(p) => saveProfile(p)}
            onSaveVariables={(v) => saveVariables(v)}
          />
        )}
      </main>

      {/* Structured Prompt Viewer & Copier Modal */}
      <PromptModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        promptText={promptModalText}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      {/* Google Drive, Backup, & Custom AI Modal */}
      <CloudIntegrationModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
        onDataRestored={handleDataRestored}
        currentDoc={currentDoc}
        profile={profile}
        onLoadDocFromCloud={(loadedDoc) => {
          setCurrentDoc(loadedDoc);
          setActiveTab('generator');
        }}
      />

      {/* Email Login & Google Drive Automatic Sync Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(email) => {
          setUserAccount(getStoredUserAccount());
        }}
        onDataRestored={handleDataRestored}
      />
    </div>
  );
}
