import React, { useState } from 'react';
import { AskAiAboutApp } from './AskAiAboutApp';
import { 
  X, 
  BookOpen, 
  ChevronDown, 
  ChevronRight, 
  Sparkles, 
  Variable, 
  Database, 
  FileText, 
  Printer, 
  Cloud, 
  Bot, 
  Sliders, 
  CheckCircle2, 
  Lightbulb, 
  Layers,
  MessageCircleQuestion
} from 'lucide-react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TutorialTopic {
  id: string;
  title: string;
  category: string;
  icon: any;
  summary: string;
  content: {
    steps: string[];
    tips?: string[];
    examples?: string[];
  };
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ isOpen, onClose }) => {
  const [expandedTopicId, setExpandedTopicId] = useState<string>('agent_ai');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAskOpen, setIsAskOpen] = useState(false);

  if (!isOpen) return null;

  const topics: TutorialTopic[] = [
    {
      id: 'login_sync',
      title: '1. Masuk Google, Cadangan & Sinkronisasi Otomatis',
      category: 'Akun & Cadangan',
      icon: Cloud,
      summary: 'Cukup masuk dengan Google — cadangan otomatis ditemukan, dipulihkan, dan disinkronkan.',
      content: {
        steps: [
          'Klik tombol "Backup & GDrive" (ikon awan) di bilah navigasi atas, buka tab "Google Drive".',
          'Klik "Masuk dengan Google", pilih akun Google-mu, lalu centang setuju pada popup Google.',
          'Aplikasi otomatis mencari file cadangan (puskesdoc_full_backup.json) di Drive-mu.',
          'Jika cadangan ditemukan, data langsung dipulihkan otomatis dan Auto-Sync diaktifkan.',
          'Di perangkat baru: cukup masuk dengan akun Google yang sama — semua data ikut pindah sendiri.',
          'Tombol "Cadangkan ke Drive" / "Sinkronkan dari Drive" tetap tersedia untuk operasi manual.',
        ],
        tips: [
          'Pencadangan berbasis Google Drive memastikan seluruh dokumen, capaian, dan konfigurasi faskes tetap aman dan dapat diakses dari perangkat mana pun.',
          'Data lokal tersimpan aman di browser Anda saat offline dan tersinkronisasi saat terhubung internet.',
        ],
      },
    },
    {
      id: 'agent_ai',
      title: '2. Pemilihan AI Agent Generator (Gemini 3.8 Flash vs Custom AI)',
      category: 'Kecerdasan Buatan (AI)',
      icon: Bot,
      summary: 'AI memakai API key Gemini milikmu sendiri (model Gemini 3.8 Flash), atau Custom AI pihak ketiga bila diaktifkan.',
      content: {
        steps: [
          'Agar AI bisa dipakai, isi dulu API Key Gemini: klik tombol "Backup & GDrive" (ikon awan) → tab "AI Agent" → tempel API key → Simpan.',
          'API key gratis bisa dibuat di https://aistudio.google.com/apikey. Key hanya tersimpan di browser ini.',
          'Pada Panel Generator di atas tombol Generate, perhatikan bagian "Pilihan AI Agent".',
          'Pilihan Default adalah "Google Gemini 3.8 Flash (API Key Pribadi)" yang memakai key milikmu sendiri.',
          'Jika Puskesmas memiliki langganan API sendiri (seperti OpenAI GPT-4o, DeepSeek, atau proxy internal), pilih opsi "Custom AI / OpenAI Compatible".',
          'Isi Base URL / Endpoint, API Key, dan nama model yang diinginkan, kemudian klik "Simpan Pengaturan Agent".',
          'Agent terpilih akan digunakan untuk memproses penyusunan naskah dinas, formulasi regulasi, dan analisis capaian.',
        ],
        tips: [
          'Google Gemini 3.8 Flash memiliki kecepatan respons tinggi dan telah dioptimalkan secara mendalam dengan pemahaman regulasi Kemenkes RI (UU Kesehatan No 17/2023, PMK No. 43/2019, & Juknis ILP).',
          'Ganti perangkat? Unduh cadangan JSON (tab Backup) lalu pulihkan di perangkat baru — API key ikut terbawa.',
        ],
        examples: [
          'Endpoint OpenAI: https://api.openai.com/v1/chat/completions',
          'Model: gpt-4o-mini atau gpt-4o',
        ],
      },
    },
    {
      id: 'generate_doc',
      title: '3. Cara Men-generate Dokumen SOP, SK, & Pedoman ILP',
      category: 'Generator Naskah',
      icon: Sparkles,
      summary: 'Langkah mudah menghasilkan naskah dinas lengkap dengan format baku akreditasi Puskesmas.',
      content: {
        steps: [
          'Pilih Jenis Dokumen: SOP (Standar Operasional Prosedur format kotak 7 sel), SK Kepala Puskesmas, KAK (Kerangka Acuan Kerja 9 Bab), Pedoman, Panduan, atau Format Kustom.',
          'Pilih Klaster ILP: Klaster 1 (Manajemen), Klaster 2 (Ibu & Anak), Klaster 3 (Dewasa & Lansia), Klaster 4 (Penanggulangan Penyakit Menular), Lintas Klaster, atau Klaster Kustom.',
          'Tentukan Jumlah Halaman yang Digenerate (1 sampai 10 halaman) sesuai kedalaman naskah yang ditargetkan.',
          'Ketik Judul Dokumen dan Nomor Surat. Jika judul mirip dengan dokumen yang pernah dibuat atau ada di Pustaka Media, sistem akan memberikan notifikasi cerdas.',
          'Tambahkan Catatan Alur / Notulensi Acuan untuk memberikan konteks khusus tata laksana di faskes Anda.',
          'Klik tombol "Generate Otomatis via AI". Progress bar interaktif akan menampilkan tahapan proses penyusunan naskah.',
          'Jika Anda ingin membatalkan proses yang sedang berjalan, klik tombol merah "Stop Generate".',
          'Setelah selesai, jendela Popup Preview akan otomatis terbuka untuk verifikasi.',
        ],
        tips: [
          'Jika Anda menutup jendela pratinjau dan ingin melihatnya kembali, gunakan tombol "Lihat Hasil" di panel lembar kerja.',
        ],
      },
    },
    {
      id: 'variables',
      title: '4. Penggunaan Variabel Otomatis Faskes {{nama_variabel}}',
      category: 'Variabel Faskes',
      icon: Variable,
      summary: 'Menyisipkan variabel profil otomatis seperti nama Puskesmas, nama Kepala, NIP, atau alamat tanpa mengetik ulang.',
      content: {
        steps: [
          'Cukup ketik dua kurung kurawal buka {{ di dalam kolom judul, nomor surat, catatan alur, atau bagian naskah.',
          'Daftar variabel yang tersedia akan muncul secara otomatis dalam popup sugesti.',
          'Gunakan tombol panah bawah / atas pada keyboard untuk memilih variabel, lalu tekan Enter.',
          'Variabel akan otomatis tergantikan dengan data riil Puskesmas saat dokumen dicetak, diekspor ke Word (.docx), atau dipratinjau.',
          'Anda dapat menambah variabel baru di tab "Variabel Faskes" pada menu navigasi atas.',
        ],
        examples: [
          '{{nama_puskesmas}} -> UPTD PUSKESMAS BABAKAN',
          '{{kepala_puskesmas}} -> dr. H. Rahmat Hidayat, M.Kes',
          '{{nip_kepala}} -> 19820415 200801 1 007',
          '{{nomor_surat_sk}} -> 440/028/SK/PKM.BBK/2026',
        ],
      },
    },
    {
      id: 'database_integration',
      title: '5. Integrasi Database & Capaian Puskesmas ke Dalam Naskah',
      category: 'Database Indikator',
      icon: Database,
      summary: 'Database mulai kosong — isi manual atau ekstrak otomatis dari berkas Word dengan AI, lalu sertakan ke dokumen.',
      content: {
        steps: [
          'Tab Database Puskesmas kini mulai dalam keadaan kosong — Anda mengisi data milik faskes sendiri.',
          'Cara cepat: klik "Tambah Data" → tab "Ekstraksi AI dari Berkas" → unggah file Word (.docx) laporan/capaian.',
          'Klik "Preview Dokumen Asli" untuk memastikan berkas yang dibaca benar, lalu tulis instruksi bila perlu dan klik "Ekstrak ke Format Database via AI".',
          'Hasil ekstraksi tampil sebagai preview rapi (judul, kategori, tabel indikator, catatan).',
          'Kurang tepat? Tulis perintah perbaikan di kolom "Perintah Perbaikan / Generate Ulang" lalu klik "Generate Ulang".',
          'Sudah sesuai? Klik "Simpan ke Database" — atau "Edit Manual di Form" untuk koreksi sendiri.',
          'Pada Panel Generator, buka "Database & Capaian Puskesmas" → "Pilih Data" → centang data untuk disitir AI ke dalam naskah.',
          'Di tab Database, Anda bebas membuat kategori kustom/manual sendiri.',
        ],
        tips: [
          'Penyusunan dokumen akreditasi berbasis data riil Puskesmas (evidence-based) menjamin nilai kelulusan Paripurna saat survei akreditasi Kemenkes.',
        ],
      },
    },
    {
      id: 'paper_margin',
      title: '6. Pengaturan Ukuran Kertas & Margin Lembar Kerja',
      category: 'Format & Tata Letak',
      icon: Sliders,
      summary: 'Mengatur ukuran kertas A4/F4 dan batas margin resmi naskah dinas tata naskah Kemenkes.',
      content: {
        steps: [
          'Di bilah atas Lembar Kerja A4, terdapat pilihan Ukuran Kertas: A4 (standar) atau F4 / Folio.',
          'Terdapat pilihan Margin Naskah Dinas:',
          '  • Margin Standar: 2 cm atas, 2 cm kiri, 2 cm kanan, 2 cm bawah (efisien dan rapi).',
          '  • Margin Naskah Dinas Resmi: 4 cm atas, 3 cm kiri, 3 cm kanan, 3 cm bawah (sesuai tata naskah dinas dinas kesehatan).',
          '  • Margin Kustom: Masukkan ukuran sentimeter secara mandiri sesuai peraturan bupati/walikota daerah Anda.',
          'Pengaturan margin dan ukuran kertas langsung diterapkan pada tampilan lembar kerja, pratinjau, pencetakan, dan ekspor Word (.docx).',
        ],
      },
    },
    {
      id: 'bracket_prompts',
      title: '7. Eksekusi Perintah Cepat dalam Kurung Siku [...]',
      category: 'Perintah Cepat AI',
      icon: Lightbulb,
      summary: 'Menginstruksikan AI untuk merevisi atau merinci pasal/bagian tertentu langsung di lembar kerja.',
      content: {
        steps: [
          'Pada bagian naskah atau prosedur yang ingin diperluas atau diubah, tulis perintah di dalam tanda kurung siku [...].',
          'Contoh: [Tambahkan langkah dekontaminasi alat dengan klorin 0.5% sesuai standar PPI]',
          'Klik tombol "Jalankan AI [...]" yang muncul di atas bagian tersebut.',
          'AI akan membaca konteks pasal dan menggantikan tanda kurung siku dengan uraian teknis yang matang dan formal.',
        ],
        examples: [
          '[Buat rincian hak dan kewajiban pasien sesuai UU Kesehatan No 17 Tahun 2023]',
          '[Lengkapi dengan indikator mutu dan target SPM Puskesmas tahun 2026]',
        ],
      },
    },
    {
      id: 'profil_kosong',
      title: 'Profil Faskes Mulai Kosong',
      category: 'Pengaturan',
      icon: Sliders,
      summary: 'Profil faskes kini kosong secara default — isi dengan data Puskesmas Anda sendiri.',
      content: {
        steps: [
          'Buka tab "Profil Faskes" — semua kolom kini kosong secara default.',
          'Isi nama Puskesmas, alamat, kontak, kepala Puskesmas, dan unggah logo pemda/Puskesmas sendiri.',
          'Data profil dipakai otomatis di kop surat, variabel {{nama_puskesmas}}, dan tanda tangan dokumen.',
          'Profil ikut tersimpan dalam cadangan (Drive/JSON) sehingga pindah perangkat tetap terbawa.',
        ],
      },
    },
    {
      id: 'kop_surat',
      title: '8. KOP Surat Resmi & Tanda Tangan Digital',
      category: 'Atribut Dokumen',
      icon: FileText,
      summary: 'Mengaktifkan KOP surat resmi Puskesmas dengan 3 mode fleksibel dan tanda tangan digital.',
      content: {
        steps: [
          'Aktifkan tombol toggle "Gunakan KOP Surat Resmi" pada panel generator.',
          'Pilih salah satu dari 3 Mode KOP melalui dropdown:',
          '  • Mode 1 (Teks Baku): KOP resmi otomatis dengan 2 logo (Pemda & Kemenkes) dan teks nama faskes.',
          '  • Mode 2 (Gambar KOP Jadi): Menggunakan banner gambar KOP penuh yang diunggah di Profil Faskes.',
          '  • Mode 3 (Editor KOP Visual): Menyesuaikan posisi logo dan tipografi secara leluasa.',
          'Tanda Tangan Kepala Puskesmas beserta stempel resmi otomatis tersaji di akhir lembar naskah dinas.',
        ],
      },
    },
    {
      id: 'save_export',
      title: '9. Menyimpan, Mengunduh DOCX, & Pustaka Media',
      category: 'Arsip & Berkas',
      icon: Layers,
      summary: 'Upload Word tampil persis aslinya & bisa diedit, template punya kategori, Pustaka Media mulai kosong.',
      content: {
        steps: [
          'Buat template baru: tab Template → "Tambah Template" → pilih "Upload Dokumen Word" atau buat manual.',
          'Dokumen Word yang diunggah kini tampil persis sesuai aslinya (tabel, kop, gambar) dan langsung bisa diklik untuk diedit di preview.',
          'Saat membuat/mengedit template, isi "Kategori Template" (mis. SOP, SK, Dokumen Word Asli) agar mudah dicari.',
          'Pada jendela Pratinjau atau Lembar Kerja, klik "Unduh .DOCX" untuk mengunduh naskah Word lengkap.',
          'Klik "Simpan ke Media" untuk menyimpan berkas ke Pustaka Media. Pustaka Media kini mulai kosong — isi dengan logo, stempel, dan dokumen faskes sendiri.',
          'Semua dokumen tercatat di "Riwayat Dokumen" sehingga terhindar dari duplikasi.',
        ],
      },
    },
    {
      id: 'print_guide',
      title: '10. Pencetakan Dokumen Presisi (Cetak Langsung)',
      category: 'Pencetakan Dokumen',
      icon: Printer,
      summary: 'Mencetak dokumen multi-halaman langsung dari browser tanpa terpotong.',
      content: {
        steps: [
          'Klik tombol "Cetak Naskah" di bilah atas lembar kerja.',
          'Sistem membuka jendela cetak presisi yang mengisolasi lembar dokumen A4.',
          'Pilih printer fisik Anda atau pilih "Save as PDF" untuk menyimpan berkas PDF.',
          'Pastikan opsi "Header and footers" pada dialog cetak browser dinonaktifkan agar tidak ada tanggal/URL bawaan browser yang mengganggu estetika dokumen.',
        ],
      },
    },
  ];

  const filteredTopics = topics.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.summary.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl h-[90vh] rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-fuchsia-700 p-5 sm:p-6 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-inner">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white">
                  Panduan Resmi
                </span>
                <span className="text-xs font-medium text-purple-200">
                  PuskesDoc ILP Edition 2026
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight mt-0.5">
                Tutorial Lengkap Penggunaan PuskesDoc
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-2xl transition-colors cursor-pointer"
            title="Tutup Panduan"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Subtitle */}
        <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-slate-600 font-medium">
            Klik topik di bawah ini untuk melihat panduan langkah demi langkah dan tips akreditasi.
          </p>
          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="Cari topik tutorial..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
            />
          </div>
        </div>

        {/* Accordion Topics List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-slate-100/70">
          {/* Panel Tanya AI */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl overflow-hidden shadow-md">
            <button
              type="button"
              onClick={() => setIsAskOpen(!isAskOpen)}
              className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-3 cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0">
                  <MessageCircleQuestion className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Tanya AI seputar aplikasi ini</p>
                  <p className="text-[11px] text-purple-100">AI hanya menjawab pertanyaan tentang penggunaan Puskesdoc Generator</p>
                </div>
              </div>
              {isAskOpen ? <ChevronDown className="w-5 h-5 text-white shrink-0" /> : <ChevronRight className="w-5 h-5 text-white shrink-0" />}
            </button>
            {isAskOpen && (
              <div className="bg-white mx-2 mb-2 rounded-xl p-4">
                <AskAiAboutApp />
              </div>
            )}
          </div>
          {filteredTopics.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              Tidak ditemukan tutorial yang sesuai dengan kata kunci "{searchQuery}".
            </div>
          ) : (
            filteredTopics.map((topic) => {
              const isExpanded = expandedTopicId === topic.id;
              const IconComponent = topic.icon;

              return (
                <div
                  key={topic.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-xs ${
                    isExpanded
                      ? 'border-purple-400 ring-2 ring-purple-500/10 shadow-md'
                      : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50/20'
                  }`}
                >
                  {/* Topic Title Button */}
                  <button
                    type="button"
                    onClick={() => setExpandedTopicId(isExpanded ? '' : topic.id)}
                    className="w-full text-left p-4 sm:p-5 flex items-start sm:items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isExpanded ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700'
                      }`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            {topic.category}
                          </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          {topic.title}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {topic.summary}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-slate-400">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-purple-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 border-t border-slate-100 bg-slate-50/50 space-y-4 animate-in fade-in duration-150">
                      {/* Step-by-step list */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                          Langkah Pelaksanaan:
                        </h4>
                        <ol className="space-y-2">
                          {topic.content.steps.map((step, idx) => (
                            <li key={idx} className="text-xs text-slate-700 flex items-start gap-2.5 leading-relaxed">
                              <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* Tips */}
                      {topic.content.tips && topic.content.tips.length > 0 && (
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs space-y-1">
                          <span className="font-bold flex items-center gap-1.5 text-amber-800">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                            Tips Penting Akreditasi:
                          </span>
                          {topic.content.tips.map((tip, idx) => (
                            <p key={idx} className="text-amber-800 text-[11px] leading-relaxed">
                              • {tip}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Examples */}
                      {topic.content.examples && topic.content.examples.length > 0 && (
                        <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-200 text-purple-950 text-xs space-y-1">
                          <span className="font-bold block text-purple-900">
                            Contoh Penggunaan:
                          </span>
                          <div className="space-y-1 font-mono text-[11px]">
                            {topic.content.examples.map((ex, idx) => (
                              <div key={idx} className="bg-white/80 p-1.5 rounded-lg border border-purple-200">
                                {ex}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <span className="text-slate-500 text-[11px]">
            Sistem Dokumen Akreditasi & Standar Integrasi Pelayanan Kesehatan Primer (ILP)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm transition-all cursor-pointer"
          >
            Mengerti & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
