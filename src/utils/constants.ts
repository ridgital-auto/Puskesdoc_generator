import { KlasterInfo, FaskesProfile, VariableItem, CustomDocTypeDefinition, DocumentTemplate } from '../types';

// Default SVG Logos for Pemda and Puskesmas / Bakti Husada
export const DEFAULT_LOGO_PEMDA = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="46" fill="%230f766e" stroke="%23facc15" stroke-width="4"/><path d="M50 18 L76 38 L68 76 L32 76 L24 38 Z" fill="%23f8fafc" stroke="%23facc15" stroke-width="2"/><circle cx="50" cy="48" r="14" fill="%230284c7"/><path d="M50 36 L54 44 L63 45 L56 51 L58 60 L50 55 L42 60 L44 51 L37 45 L46 44 Z" fill="%23eab308"/></svg>`;

export const DEFAULT_LOGO_PUSKESMAS = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="46" fill="%23ffffff" stroke="%2316a34a" stroke-width="4"/><path d="M42 22 H58 V42 H78 V58 H58 V78 H42 V58 H22 V42 H42 Z" fill="%2316a34a"/><circle cx="50" cy="50" r="10" fill="%23ffffff"/><circle cx="50" cy="50" r="6" fill="%23dc2626"/></svg>`;

export const ILP_KLASTERS: KlasterInfo[] = [
  {
    id: 'KLASTER_1',
    number: 1,
    name: 'Klaster 1: Manajemen',
    description: 'Manajemen Puskesmas, Ketatausahaan, Kepegawaian, Keuangan, Sarpras, Mutu, dan Manajemen Risiko',
    examples: [
      'SOP Lokakarya Mini Bulanan & Triwulanan',
      'SK Penetapan Struktur Organisasi ILP Puskesmas',
      'KAK Audit Internal & Rapat Tinjauan Manajemen (RTM)',
      'Pedoman Tata Kelola Mutu Puskesmas',
    ],
  },
  {
    id: 'KLASTER_2',
    number: 2,
    name: 'Klaster 2: Ibu dan Anak',
    description: 'Pelayanan Ibu Hamil (ANC), Persalinan, Nifas, Bayi, Balita, Usia Sekolah, dan Remaja',
    examples: [
      'SOP Pemeriksaan Kehamilan (ANC Terpadu 6 Kali)',
      'SOP Skrining Anemia dan Tablet Tambah Darah Remaja Putri',
      'KAK Posyandu Integrasi Layanan Primer Siklus Hidup',
      'SK Tim Penurunan Stunting Puskesmas',
    ],
  },
  {
    id: 'KLASTER_3',
    number: 3,
    name: 'Klaster 3: Usia Dewasa & Lansia',
    description: 'Skrining Penyakit Tidak Menular (PTM), Hipertensi, DM, Obesitas, Kesehatan Jiwa, Usia Lanjut, dan Geriatri',
    examples: [
      'SOP Skrining Faktor Risiko PTM Usia Produktif',
      'SOP Penatalaksanaan Pasien Hipertensi dan DM Terkontrol',
      'KAK Skrining Tingkat Kemandirian Lansia (ADL)',
      'SOP Deteksi Dini Kanker Payudara dan Leher Rahim (SADANIS/IVA)',
    ],
  },
  {
    id: 'KLASTER_4',
    number: 4,
    name: 'Klaster 4: Penanggulangan Penyakit Menular',
    description: 'Surveilans Penyakit, Penemuan & Pengobatan TB, HIV, Kusta, DBD, ISPA, Diare, Imunisasi Rutin, dan KLB',
    examples: [
      'SOP Penemuan Kasus dan Terapi Pencegahan TBC (TPT)',
      'SOP Surveilans Berbasis Kejadian dan Respon Cepat KLB',
      'KAK Penyelidikan Epidemiologi Kasus Demam Berdarah Dengue',
      'SK Tim Gerak Cepat (TGC) Penanggulangan KLB',
    ],
  },
  {
    id: 'LINTAS_KLASTER',
    number: 5,
    name: 'Klaster 5: Lintas Klaster (Farmasi, Laboratorium & Kegawatdaruratan)',
    description: 'Pelayanan Farmasi, Laboratorium Klinis Terintegrasi, Tindakan Gawat Darurat (UGD), dan Rawat Inap',
    examples: [
      'SOP Triase dan Penanganan Kegawatdaruratan Medis',
      'SOP Pengelolaan Obat High Alert dan LASA',
      'SOP Pemeriksaan Laboratorium Hematologi Rutin',
      'Pedoman Pelayanan Kefarmasian Integrasi Layanan Primer',
    ],
  },
  {
    id: 'KUSTOM',
    number: '*',
    name: 'Klaster Kustom / Manual',
    description: 'Klaster khusus atau divisi kerja spesifik yang ditentukan secara mandiri oleh Puskesmas',
    examples: [],
  },
];

export const DEFAULT_FASKES_PROFILE: FaskesProfile = {
  namaPuskesmas: '',
  kodeFaskes: '',
  dinasKesehatan: '',
  pemerintahDaerah: '',
  alamat: '',
  kecamatan: '',
  kabupatenKota: '',
  provinsi: '',
  telepon: '',
  email: '',
  website: '',
  kepalaPuskesmas: '',
  nipKepala: '',
  jabatanKepala: '',
  logoPemda: DEFAULT_LOGO_PEMDA,
  logoPuskesmas: DEFAULT_LOGO_PUSKESMAS,
  useKopDefault: true,
};

export const INITIAL_VARIABLES: VariableItem[] = [
  { id: 'v1', key: 'nama_puskesmas', label: 'Nama Puskesmas', value: 'UPTD PUSKESMAS BABAKAN', category: 'faskes' },
  { id: 'v2', key: 'dinas_kesehatan', label: 'Dinas Kesehatan', value: 'DINAS KESEHATAN KABUPATEN CIREBON', category: 'faskes' },
  { id: 'v3', key: 'pemerintah_daerah', label: 'Pemerintah Daerah', value: 'PEMERINTAH KABUPATEN CIREBON', category: 'faskes' },
  { id: 'v4', key: 'alamat_puskesmas', label: 'Alamat Faskes', value: 'Jl. Pangeran Sutajaya No. 45, Babakan', category: 'faskes' },
  { id: 'v5', key: 'kode_faskes', label: 'Kode Puskesmas', value: 'P3209010101', category: 'faskes' },
  { id: 'v6', key: 'kepala_puskesmas', label: 'Nama Kepala Puskesmas', value: 'dr. H. AHMAD FAUZI, M.M.Kes', category: 'nakes' },
  { id: 'v7', key: 'nip_kapus', label: 'NIP Kepala Puskesmas', value: '19780512 200501 1 008', category: 'nakes' },
  { id: 'v8', key: 'ketua_tim_mutu', label: 'Ketua Tim Mutu', value: 'drg. SITI NURHALIZA', category: 'nakes' },
  { id: 'v9', key: 'pj_klaster_1', label: 'PJ Klaster 1 (Manajemen)', value: 'HENDRA WIJAYA, S.KM', category: 'nakes' },
  { id: 'v10', key: 'pj_klaster_2', label: 'PJ Klaster 2 (Ibu & Anak)', value: 'Bd. NUR AINI, S.Tr.Keb', category: 'nakes' },
  { id: 'v11', key: 'pj_klaster_3', label: 'PJ Klaster 3 (Dewasa & Lansia)', value: 'dr. INDAH LESTARI', category: 'nakes' },
  { id: 'v12', key: 'pj_klaster_4', label: 'PJ Klaster 4 (P2M)', value: 'RIDWAN SETIADI, S.Kep., Ners', category: 'nakes' },
  { id: 'v13', key: 'pj_lintas_klaster', label: 'PJ Lintas Klaster', value: 'apt. RIZKI PRATAMA, S.Farm', category: 'nakes' },
  { id: 'v14', key: 'tahun_anggaran', label: 'Tahun Anggaran', value: '2026', category: 'dokumen' },
  { id: 'v15', key: 'nomor_surat_sk', label: 'No SK Standar', value: '440/012/SK/PKM.BBK/2026', category: 'dokumen' },
];

export const DEFAULT_CUSTOM_DOC_TYPES: CustomDocTypeDefinition[] = [
  {
    id: 'notulen_rtm',
    name: 'Notulen Rapat Tinjauan Manajemen (RTM)',
    description: 'Format notulensi evaluasi mutu dan kinerja puskesmas terstandar',
    defaultSections: ['Waktu & Tempat', 'Peserta Rapat', 'Agenda Pembahasan', 'Hasil Diskusi & Temuan', 'Rencana Tindak Lanjut (RTL)'],
  },
  {
    id: 'bukti_pelaksanaan',
    name: 'Bukti Pelaksanaan Kegiatan & Verifikasi',
    description: 'Format dokumentasi pelaksanaan pelayanan klaster ILP untuk bukti telusur surveyor',
    defaultSections: ['Nama Kegiatan', 'Dasar Pelaksanaan', 'Waktu dan Sasaran', 'Uraian Pelaksanaan', 'Dokumentasi Visual & Absensi', 'Verifikasi PJ Klaster'],
  },
  {
    id: 'audit_internal',
    name: 'Lembar Laporan Audit Internal',
    description: 'Format audit kepatuhan SOP dan standar akreditasi faskes',
    defaultSections: ['Unit/Klaster yang Diaudit', 'Auditor & Tanggal Audit', 'Standar/Kriteria yang Dinilai', 'Temuan Ketidaksesuaian', 'Rekomendasi Tindakan Korektif'],
  },
];

export const DEFAULT_DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: 'tpl_sop_standar',
    name: 'SOP Standar Akreditasi Kemenkes (Kotak 7 Sel)',
    docType: 'SOP',
    category: 'SOP Pelayanan & Operasional',
    description: 'Format resmi Standar Operasional Prosedur Puskesmas dengan tabel kotak akreditasi Kemenkes RI',
    isBuiltIn: true,
    useKopDefault: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sections: [
      { id: 'sec_1', title: '1. Pengertian', content: 'Uraian definisi dan ruang lingkup pelayanan terintegrasi di {{nama_puskesmas}}...' },
      { id: 'sec_2', title: '2. Tujuan', content: 'Sebagai acuan penerapan langkah-langkah dalam pelayanan berkualitas bagi seluruh sasaran...' },
      { id: 'sec_3', title: '3. Kebijakan', content: 'Surat Keputusan Kepala {{nama_puskesmas}} Nomor {{nomor_surat_sk}} tentang Standar Pelayanan.' },
      { id: 'sec_4', title: '4. Referensi', content: '1. Undang-Undang Nomor 17 Tahun 2023 tentang Kesehatan\n2. Kepmenkes HK.01.07/MENKES/2015/2023 tentang Juknis Integrasi Pelayanan Kesehatan Primer' },
      { id: 'sec_5', title: '5. Prosedur / Langkah-Langkah', content: '1. Petugas menyapa pasien dengan ramah dan memverifikasi identitas.\n2. Petugas melakukan anamnesis terpadu dan pengukuran tanda vital.\n3. Petugas memberikan pelayanan sesuai siklus hidup.\n4. Petugas mencatat hasil pemeriksaan ke sistem rekam medis.' },
      { id: 'sec_6', title: '6. Diagram Alir', content: 'Pendaftaran -> Ruang Pelayanan Klaster -> Pemeriksaan Penunjang (bila perlu) -> Farmasi/Konseling' },
      { id: 'sec_7', title: '7. Unit Terkait', content: 'Pendaftaran, Ruang Pemeriksaan Klaster, Laboratorium, Farmasi' },
      { id: 'sec_8', title: '8. Rekaman Historis Perubahan', content: 'No | Yang Diubah | Isi Perubahan | Tgl Diberlakukan\n1.  | Format Dokumen | Penyesuaian Standar ILP | 2026' },
    ],
  },
];

export const INITIAL_DATABASE_ITEMS: Array<import('../types').PuskesmasDatabaseItem> = [
  {
    id: 'db_spm_2025',
    title: 'Capaian 12 Indikator Standar Pelayanan Minimal (SPM) Kesehatan',
    category: 'spm',
    period: 'Tahun 2025 (Tahunan)',
    klaster: 'KLASTER_1',
    summary: 'Rekapitulasi pencapaian 12 indikator SPM bidang kesehatan wilayah kerja UPTD Puskesmas Babakan tahun 2025.',
    metrics: [
      { key: 'Pelayanan Kesehatan Ibu Hamil (K6)', value: '89.4%', target: '100%', unit: '%', status: 'belum_tercapai' },
      { key: 'Pelayanan Kesehatan Ibu Bersalin (Persalinan Faskes)', value: '94.2%', target: '100%', unit: '%', status: 'tercapai' },
      { key: 'Pelayanan Kesehatan Bayi Baru Lahir (KN Lengkap)', value: '95.1%', target: '100%', unit: '%', status: 'tercapai' },
      { key: 'Pelayanan Kesehatan Balita Sesuai Standar', value: '88.6%', target: '100%', unit: '%', status: 'belum_tercapai' },
      { key: 'Pelayanan Kesehatan Usia Pendidikan Dasar', value: '96.0%', target: '100%', unit: '%', status: 'tercapai' },
      { key: 'Skrining Kesehatan Usia Produktif (15-59 th)', value: '74.5%', target: '100%', unit: '%', status: 'dalam_pantauan' },
      { key: 'Skrining Kesehatan Warga Usia Lanjut (60+ th)', value: '78.2%', target: '100%', unit: '%', status: 'dalam_pantauan' },
      { key: 'Pelayanan Penderita Hipertensi Sesuai Standar', value: '68.4%', target: '100%', unit: '%', status: 'belum_tercapai' },
      { key: 'Pelayanan Penderita Diabetes Melitus Sesuai Standar', value: '64.8%', target: '100%', unit: '%', status: 'belum_tercapai' },
      { key: 'Pelayanan Kesehatan ODGJ Berat Sesuai Standar', value: '86.0%', target: '100%', unit: '%', status: 'tercapai' },
      { key: 'Pelayanan Orang Terduga Tuberkulosis (TBC)', value: '81.2%', target: '100%', unit: '%', status: 'dalam_pantauan' },
      { key: 'Pelayanan Orang dengan Risiko Terinfeksi HIV', value: '92.0%', target: '100%', unit: '%', status: 'tercapai' },
    ],
    notes: 'Prioritas tindak lanjut pada peningkatan kepatuhan pengobatan Hipertensi dan DM melalui Pustu ILP dan Posyandu siklus hidup.',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

