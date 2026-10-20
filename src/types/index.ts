import type { OoxmlFill } from '../utils/docxOoxmlFill';

export type DocumentType = 'SOP' | 'SK' | 'KAK' | 'PEDOMAN' | 'PANDUAN' | 'CUSTOM';

export type IlpKlaster = 
  | 'KLASTER_1' // Manajemen
  | 'KLASTER_2' // Ibu dan Anak
  | 'KLASTER_3' // Usia Dewasa dan Lanjut Usia
  | 'KLASTER_4' // Penanggulangan Penyakit Menular
  | 'LINTAS_KLASTER' // Farmasi, Laboratorium, Gawat Darurat
  | 'KUSTOM'; // Klaster Kustom / Manual

export interface KlasterInfo {
  id: IlpKlaster;
  number: number | string;
  name: string;
  description: string;
  examples: string[];
}

export interface FaskesProfile {
  namaPuskesmas: string;
  kodeFaskes: string;
  dinasKesehatan: string;
  pemerintahDaerah: string;
  alamat: string;
  kecamatan: string;
  kabupatenKota: string;
  provinsi: string;
  telepon: string;
  email: string;
  website?: string;
  kepalaPuskesmas: string;
  nipKepala: string;
  jabatanKepala: string;
  logoPemda: string; // base64 data URL
  logoPuskesmas: string; // base64 data URL
  gambarKopJadi?: string; // full uploaded KOP image
  kopMode?: 'manual' | 'image' | 'drag_editor';
  useKopDefault: boolean;
}

export interface VariableItem {
  id: string;
  key: string; // e.g. "nama_puskesmas"
  label: string;
  value: string;
  category: 'faskes' | 'nakes' | 'dokumen' | 'custom';
}

export interface SectionImage {
  id: string;
  dataUrl: string;
  /** lebar tampilan dalam px */
  width: number;
  /** bila melayang: posisi absolut relatif terhadap kertas */
  floating?: boolean;
  left?: number;
  top?: number;
}

export interface DocumentSection {
  id: string;
  title: string;
  content: string;
  images?: SectionImage[];
}

export interface SopMetadata {
  noDokumen: string;
  noRevisi: string;
  tanggalTerbit: string;
  halaman: string;
  unitTerkait: string;
  penanggungJawab: string;
}

export interface PuskesDoc {
  id: string;
  title: string;
  docType: DocumentType;
  customTypeName?: string;
  klaster: IlpKlaster;
  customKlasterName?: string;
  docNumber: string;
  createdAt: string;
  updatedAt: string;
  useKop: boolean;
  kopMode?: 'manual' | 'image' | 'drag_editor';
  targetPages?: number;
  showPageNumber?: boolean;
  pageNumberPosition?: 'bottom-right' | 'bottom-center' | 'bottom-left' | 'top-right' | 'top-center';
  sopMetadata?: SopMetadata;
  sections: DocumentSection[];
  rawFormattedText?: string;
  originalDocxHtml?: string;
  originalDocxBase64?: string;
  /** Data isian [...] untuk unduhan via file Word asli (fidelity 100%).
   *  Dihapus otomatis bila pengguna mengedit naskah setelah generate. */
  templateFillOoxml?: { fills: OoxmlFill[] };
  /** true bila originalDocxBase64 sudah berisi dokumen JADI (hasil isi-template)
   *  sehingga unduhan tinggal pakai berkasnya langsung. */
  docxBase64Ready?: boolean;
  /** ID template pustaka yang dimuat ke dokumen ini (untuk deteksi versi baru). */
  sourceTemplateId?: string;
  /** updatedAt template saat dimuat (untuk deteksi versi baru). */
  sourceTemplateUpdatedAt?: string;
}

export interface CanvasElement {
  id: string;
  type: 'text' | 'kop' | 'sop_header' | 'table' | 'signature' | 'column_split' | 'divider';
  x: number; // in pixels relative to paper canvas
  y: number;
  width: number;
  height: number;
  content: string;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  isBold?: boolean;
  columnCount?: number;
  boundVariable?: string;
}

export interface CanvasTemplate {
  id: string;
  name: string;
  docType: DocumentType;
  orientation: 'portrait' | 'landscape';
  paperSize: 'A4' | 'F4';
  elements: CanvasElement[];
  createdAt: string;
}

export interface CustomAgentConfig {
  id: string;
  enabled: boolean;
  name: string;
  /** true = tanpa API key (mis. Pollinations gratis) */
  noKey?: boolean;
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface CustomDocTypeDefinition {
  id: string;
  name: string;
  description: string;
  defaultSections: string[];
}

export interface DocumentTemplate {
  id: string;
  name: string;
  docType: DocumentType | string;
  category: string;
  description: string;
  sections: DocumentSection[];
  useKopDefault?: boolean;
  kopMode?: 'manual' | 'image' | 'drag_editor';
  orientation?: 'portrait' | 'landscape';
  pageCount?: number;
  columnCount?: number;
  originalDocxHtml?: string;
  originalDocxBase64?: string;
  createdAt: string;
  updatedAt: string;
  isBuiltIn?: boolean;
  /** Template default: otomatis terpilih saat Generator dibuka. */
  isDefault?: boolean;
}

export interface MediaItem {
  id: string;
  name: string;
  type: 'image' | 'document';
  mimeType: string;
  size: number;
  dataUrl: string; // Base64 data URL or text content
  createdAt: string;
  category: 'logo' | 'stempel' | 'foto' | 'sop' | 'form' | 'surat' | 'lainnya';
  description?: string;
  dimensions?: { width: number; height: number };
}

export type DatabaseCategory =
  | 'capaian_program'
  | 'spm'
  | 'indikator_mutu'
  | 'sdmk_ketenagaan'
  | 'sarpras_alkes'
  | 'demografi_sasaran'
  | 'surveilans_penyakit'
  | 'kinerja_keuangan'
  | 'kustom'
  | (string & {});

export interface DatabaseMetric {
  key: string;       // e.g. "Cakupan K4", "Kepatuhan Hand Hygiene"
  value: string;     // e.g. "89.4%", "1,450 jiwa", "14 orang"
  unit?: string;     // e.g. "%", "jiwa", "orang", "unit"
  target?: string;   // e.g. "100%", "90%"
  status?: 'tercapai' | 'belum_tercapai' | 'dalam_pantauan';
}

export interface PuskesmasDatabaseItem {
  id: string;
  title: string;              // e.g. "Laporan Capaian SPM KIA & KB Tahun 2025"
  category: DatabaseCategory;
  period: string;             // e.g. "Tahun 2025", "Semester 1 2026"
  klaster?: IlpKlaster;       // e.g. KLASTER_2
  summary: string;            // summary description of the data
  metrics: DatabaseMetric[];  // individual data points
  notes?: string;             // analytical notes / issues / rekomendasi
  updatedAt: string;
  createdAt: string;
}

