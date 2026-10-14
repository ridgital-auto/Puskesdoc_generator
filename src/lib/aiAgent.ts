/**
 * aiAgent.ts — Mesin AI Puskesdoc yang berjalan langsung di browser.
 *
 * Sebelumnya semua panggilan AI lewat backend Express (/api/*) yang memakai
 * GEMINI_API_KEY dari server. Di GitHub Pages tidak ada backend, jadi modul
 * ini memanggil Google Gemini langsung dari browser memakai API key milik
 * pengguna sendiri (disimpan di localStorage, tidak dikirim ke mana pun
 * selain ke server resmi Google).
 *
 * Prioritas: Custom AI Agent (jika diaktifkan) -> Gemini API key pribadi ->
 * fallback ke backend /api/* (untuk yang menjalankan server lokal).
 */
import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey } from '../utils/storage';
import type { CustomAgentConfig } from '../types';

export const GEMINI_FLASH_MODEL = 'gemini-3.8-flash';

export const AI_KEY_HELP =
  'API Key Gemini belum diisi. Klik tombol "Backup & GDrive" (ikon awan) di atas, buka tab "AI Agent", lalu masukkan API Key Gemini kamu. Gratis: https://aistudio.google.com/apikey';

// Instruksi sistem ILP — sama persis dengan yang dipakai backend.
export const ILP_SYSTEM_INSTRUCTION = `Anda adalah Ahli Tata Naskah Dinas dan Tim Akreditasi Puskesmas Kemenkes RI berpengalaman dengan standar Integrasi Layanan Primer (ILP) terbaru (Klaster 1 s/d 5).
Anda membuat dan merapikan dokumen akreditasi Puskesmas sesuai kaidah baku:
1. SOP (Standar Operasional Prosedur):
   - Tabel kotak akreditasi resmi Kemenkes RI
   - 1. Pengertian
   - 2. Tujuan
   - 3. Kebijakan
   - 4. Referensi (Permenkes terbaru, Kepmenkes HK.01.07/MENKES/2015/2023 tentang ILP)
   - 5. Prosedur / Langkah-langkah kerja berurutan dan terinci
   - 6. Diagram Alir (penjelasan alur)
   - 7. Unit / Klaster Terkait
   - 8. Rekaman Historis Perubahan
2. SK (Surat Keputusan Kepala Puskesmas):
   - Judul & Nomor Keputusan
   - Konsiderans: Menimbang (poin a, b, c), Mengingat (UU Kesehatan No 17 Tahun 2023, Permenkes No 43/2019, Regulasi ILP Kemenkes)
   - Diktum MEMUTUSKAN: KESATU, KEDUA, KETIGA, KEEMPAT
   - Lampiran SK jika ada
3. KAK (Kerangka Acuan Kerja):
   - I. Pendahuluan
   - II. Latar Belakang
   - III. Tujuan Umum dan Khusus
   - IV. Kegiatan Pokok dan Rincian Kegiatan (sesuai Klaster ILP)
   - V. Cara Melaksanakan Kegiatan
   - VI. Sasaran
   - VII. Jadwal Pelaksanaan Kegiatan
   - VIII. Evaluasi Pelaksanaan Kegiatan dan Pelaporan
   - IX. Pencatatan, Pelaporan, dan Evaluasi Kegiatan
4. Pedoman / Panduan:
   - Sistematika bab pedoman operasional ILP Puskesmas.

5. PANDUAN EKSEKUSI PROMPT DALAM KURUNG SIKU [...]:
   - Setiap teks yang berada di dalam kurung siku [...] (contoh: [rincikan alur pemeriksaan ANC 6x], [uraikan tugas nakes dan kader], dll) adalah PERINTAH / PROMPT LANGSUNG DARI PENGGUNA UNTUK DIJALANKAN OLEH AI.
   - AI WAJIB mengeksekusi perintah tersebut secara komprehensif dan menghasilkan naskah bermutu tinggi sesuai pedoman akreditasi ILP.
   - Gantikan kurung siku [...] tersebut dengan isi naskah hasil generasi dari perintah tersebut (jangan biarkan tanda kurung siku tertinggal).

Gunakan gaya bahasa naskah dinas kedinasan resmi Indonesia yang lugas, presisi, dan sesuai standar Puskesmas.`;

export function getGeminiClient(): GoogleGenAI {
  const key = (getGeminiApiKey() || '').trim();
  if (!key) {
    throw new Error(AI_KEY_HELP);
  }
  return new GoogleGenAI({ apiKey: key });
}

function cleanJsonFences(text: string): string {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

function tryParseJson(text: string): any | null {
  const cleaned = cleanJsonFences(text);
  // Coba langsung dulu (kasus ideal: JSON murni seperti dari Gemini)
  try {
    return JSON.parse(cleaned);
  } catch {
    /* lanjut ke ekstraksi */
  }
  // Model gratis (mis. Pollinations) sering menambahkan teks pembuka/penutup
  // di sekitar JSON ("Berikut hasilnya: {...} semoga membantu").
  // Ambil potongan dari '{' pertama sampai '}' terakhir lalu parse.
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/** Panggil endpoint OpenAI-compatible milik pengguna (Custom AI Agent). */
async function callCustomAgentText(
  cfg: CustomAgentConfig,
  userPrompt: string,
  temperature: number,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: ILP_SYSTEM_INSTRUCTION },
        { role: 'user', content: userPrompt },
      ],
      temperature,
    }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Custom AI Agent error (${response.status}). Periksa endpoint & API key di tab AI Agent.`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/** Fallback: teruskan ke backend /api/* bila tersedia (mode server lokal). */
async function callBackendFallback(
  path: string,
  body: any,
  signal?: AbortSignal,
): Promise<any> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, error: AI_KEY_HELP };
    }
  } catch {
    return { success: false, error: AI_KEY_HELP };
  }
}

function hasDirectAccess(customAgentConfig?: CustomAgentConfig): boolean {
  if (customAgentConfig && customAgentConfig.enabled && customAgentConfig.endpoint && (customAgentConfig.apiKey || customAgentConfig.noKey)) return true;
  return !!(getGeminiApiKey() || '').trim();
}

export interface GenerateDocumentParams {
  docType: string;
  klaster: string;
  title: string;
  context?: string;
  variables?: Record<string, any>;
  customInstructions?: string;
  customAgentConfig?: CustomAgentConfig;
  targetPages?: string | number;
  selectedDatabaseItems?: any[];
  signal?: AbortSignal;
}

function buildGeneratePrompt(p: GenerateDocumentParams): { promptText: string; docTitle: string; klasterLabel: string; pageCount: number } {
  const klasterLabel = p.klaster || 'Klaster 1: Manajemen';
  const docTitle = p.title || `Dokumen ${p.docType} ${klasterLabel}`;
  const pageCount = p.targetPages ? parseInt(String(p.targetPages), 10) : 2;

  const combinedInput = `${p.title || ''} ${p.context || ''} ${p.customInstructions || ''}`;
  const bracketMatches = combinedInput.match(/\[(.*?)\]/g);
  const bracketPromptList = bracketMatches && bracketMatches.length > 0
    ? bracketMatches.map((b, i) => `${i + 1}. ${b}`).join('\n')
    : 'Tidak ada prompt kurung siku khusus.';

  let formattedDatabaseContext = 'Tidak ada database capaian khusus yang dipilih.';
  if (Array.isArray(p.selectedDatabaseItems) && p.selectedDatabaseItems.length > 0) {
    formattedDatabaseContext = p.selectedDatabaseItems.map((item: any, idx: number) => `
[DATA ${idx + 1}: ${item.title} (${item.period || 'Periode Terkini'}) - Kategori: ${item.category}]
Ringkasan Data: ${item.summary}
Daftar Capaian / Indikator:
${(item.metrics || []).map((m: any) => `  * ${m.key}: ${m.value}${m.target ? ` (Target: ${m.target})` : ''} ${m.unit ? `[${m.unit}]` : ''} - Status: ${m.status || 'terdata'}`).join('\n')}
Catatan & Rekomendasi Faskes: ${item.notes || '-'}
`).join('\n----------------------------------------\n');
  }

  const promptText = `Tolong buatkan draf dokumen akreditasi Puskesmas lengkap:
- Jenis Dokumen: ${p.docType}
- Klaster ILP: ${klasterLabel}
- Judul Dokumen: ${docTitle}
- Target Jumlah Halaman: ${pageCount} halaman (susun materi, butir prosedur, dan pembahasan agar cukup dan proporsional untuk ${pageCount} halaman A4)
- Catatan Alur / Konteks Khusus: ${p.context || 'Gunakan alur dan standar pelayanan baku Puskesmas ILP'}
- Instruksi Tambahan: ${p.customInstructions || 'Sesuai format akreditasi resmi'}

DATABASE & CAPAIAN PUSKESMAS TERPILIH SEBAGAI DASAR NASKAH (WAJIB DISITIR & DIINTEGRASIKAN):
${formattedDatabaseContext}
*INSTRUKSI DATABASE*: Apabila terdapat data capaian Puskesmas di atas, gunakan angka-angka dan fakta riil tersebut ke dalam latar belakang, kebijakan, prosedur, evaluasi, atau indikator kinerja dokumen!

PANDUAN EKSEKUSI PERINTAH DALAM KURUNG SIKU [...]:
${bracketPromptList}
*PENTING*: Teks di dalam tanda kurung siku [...] di atas adalah perintah langsung dari pengguna. Jalankan setiap perintah tersebut secara rinci dan gantikan tanda kurung siku dengan teks hasil generasi yang matang dan formal.

- Variabel Data Faskes:
${JSON.stringify(p.variables || {}, null, 2)}

Format respon yang diharapkan:
PENTING: Jawab HANYA dengan JSON valid — tanpa kalimat pembuka, tanpa penjelasan, tanpa teks penutup. Langsung mulai dari karakter { dan akhiri di }.
Kembalikan respon JSON murni (JSON parsable) dengan struktur:
{
  "title": "${docTitle}",
  "docNumber": "contoh nomor surat/SOP",
  "docType": "${p.docType}",
  "klaster": "${klasterLabel}",
  "summary": "ringkasan singkat dokumen",
  "sections": [
    { "title": "Nama Bagian", "content": "Isi uraian bagian..." }
  ],
  "sopMetadata": {
    "noDokumen": "...",
    "noRevisi": "00",
    "tanggalTerbit": "...",
    "halaman": "1/2",
    "penanggungJawab": "..."
  },
  "rawFormattedText": "Teks naskah lengkap tersusun rapi jika dibutuhkan untuk salin teks"
}`;
  return { promptText, docTitle, klasterLabel, pageCount };
}

export async function aiGenerateDocument(p: GenerateDocumentParams): Promise<any> {
  const { promptText, docTitle, klasterLabel } = buildGeneratePrompt(p);
  const customCfg = p.customAgentConfig;

  if (!hasDirectAccess(customCfg)) {
    return callBackendFallback('/api/generate-document', { ...p, signal: undefined }, p.signal);
  }

  try {
    if (customCfg && customCfg.enabled && customCfg.endpoint && (customCfg.apiKey || customCfg.noKey)) {
      const reply = await callCustomAgentText(customCfg, promptText, 0.7, p.signal);
      const parsed = tryParseJson(reply);
      if (parsed) return { success: true, data: parsed, provider: 'custom' };
      return {
        success: true,
        data: {
          title: docTitle, docType: p.docType, klaster: klasterLabel,
          sections: [{ title: 'Isi Dokumen', content: reply }],
          rawFormattedText: reply,
        },
        provider: 'custom',
      };
    }

    const ai = getGeminiClient();
    const geminiResponse = await ai.models.generateContent({
      model: GEMINI_FLASH_MODEL,
      contents: promptText,
      config: {
        systemInstruction: ILP_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
      },
    });
    const text = geminiResponse.text || '{}';
    const parsed = tryParseJson(text);
    if (parsed) return { success: true, data: parsed, provider: 'gemini' };
    return {
      success: true,
      data: {
        title: docTitle, docType: p.docType, klaster: klasterLabel,
        sections: [{ title: 'Hasil Dokumen', content: text }],
        rawFormattedText: text,
      },
      provider: 'gemini',
    };
  } catch (error: any) {
    if (error?.name === 'AbortError') throw error;
    return { success: false, error: error.message || 'Gagal menghasilkan dokumen' };
  }
}

export interface ExecuteBracketParams {
  sectionTitle: string;
  sectionContent: string;
  docType?: string;
  klaster?: string;
  docTitle?: string;
  variables?: Record<string, any>;
  customAgentConfig?: CustomAgentConfig;
  selectedDatabaseItems?: any[];
}

export async function aiExecuteBracketPrompt(p: ExecuteBracketParams): Promise<any> {
  const bracketMatches = (p.sectionContent || '').match(/\[(.*?)\]/g);
  if (!bracketMatches || bracketMatches.length === 0) {
    return { success: false, error: 'Tidak ditemukan perintah dalam kurung siku [...]' };
  }

  let databaseContext = '';
  if (Array.isArray(p.selectedDatabaseItems) && p.selectedDatabaseItems.length > 0) {
    databaseContext = `\nDATA & CAPAIAN PUSKESMAS SEBAGAI REFERENSI:\n` + p.selectedDatabaseItems.map((item: any, i: number) => `
${i + 1}. ${item.title} (${item.period}):
   Ringkasan: ${item.summary}
   Metrik: ${(item.metrics || []).map((m: any) => `${m.key}: ${m.value}`).join(', ')}
   Catatan: ${item.notes || '-'}
`).join('\n');
  }

  const promptText = `Anda adalah Ahli Regulasi & Tata Naskah Akreditasi Puskesmas ILP.
Pengguna sedang menyusun dokumen "${p.docTitle || 'Dokumen Akreditasi'}" (${p.docType || 'SOP'}, ${p.klaster || 'ILP'}).
Pada bagian "${p.sectionTitle || 'Seksi Dokumen'}", terdapat instruksi khusus dalam tanda kurung siku [...]:
${bracketMatches.map((m: string, i: number) => `${i + 1}. ${m}`).join('\n')}

Teks asli seksi saat ini:
"""
${p.sectionContent}
"""

Variabel Faskes:
${JSON.stringify(p.variables || {}, null, 2)}
${databaseContext}

TUGAS ANDA:
1. Jalankan setiap perintah atau instruksi yang ada di dalam tanda kurung siku [...] tersebut secara mendalam dan profesional.
2. Hasilkan uraian naskah yang lengkap, runtut, berstandar akreditasi Puskesmas Kemenkes RI.
3. Gantikan setiap tanda kurung siku [...] dengan teks hasil eksekusi perintah tersebut secara mulus tanpa meninggalkan tanda kurung siku.
4. Kembalikan teks bagian yang utuh dan siap pakai (hanya kirimkan teks naskah yang sudah selesai).`;

  const customCfg = p.customAgentConfig;
  if (!hasDirectAccess(customCfg)) {
    return callBackendFallback('/api/execute-bracket-prompt', p);
  }

  try {
    if (customCfg && customCfg.enabled && customCfg.endpoint && (customCfg.apiKey || customCfg.noKey)) {
      const reply = await callCustomAgentText(customCfg, promptText, 0.7);
      return { success: true, updatedContent: reply.trim() };
    }
    const ai = getGeminiClient();
    const geminiResponse = await ai.models.generateContent({
      model: GEMINI_FLASH_MODEL,
      contents: promptText,
      config: { systemInstruction: ILP_SYSTEM_INSTRUCTION },
    });
    const resultText = geminiResponse.text?.trim() || p.sectionContent;
    return { success: true, updatedContent: resultText };
  } catch (error: any) {
    return { success: false, error: error.message || 'Gagal menjalankan perintah AI' };
  }
}

export interface AnalyzeTemplateParams {
  sampleText: string;
  customInstructions?: string;
  customAgentConfig?: CustomAgentConfig;
}

export async function aiAnalyzeTemplate(p: AnalyzeTemplateParams): Promise<any> {
  if (!p.sampleText || p.sampleText.trim().length === 0) {
    return { success: false, error: 'Teks dokumen contoh tidak boleh kosong' };
  }
  const analyzePrompt = `Anda adalah Analis Tata Naskah Akreditasi Puskesmas.
Berikut adalah contoh dokumen akreditasi:
"""
${p.sampleText}
"""

Instruksi Tambahan: ${p.customInstructions || 'Deteksi bagian tetap dan bagian variabel'}

Tolong analisis dokumen ini:
1. Temukan bagian teks mana yang statis (klausul baku/hukum/tetap).
2. Temukan bagian teks mana yang dinamis (bisa diubah dan diisi oleh pengguna, misalnya nama kegiatan, tanggal, nomor surat, sasaran, nama puskesmas).
3. Berikan saran variabel dengan format {{nama_variabel}} (contoh: {{nama_kegiatan}}, {{tanggal_terbit}}, {{target_sasaran}}).
4. Buatkan versi template bersih di mana bagian dinamis sudah diganti menjadi placeholder {{...}}.

Kembalikan respon JSON terstruktur:
{
  "documentTypeDetected": "SOP / SK / KAK / Lainnya",
  "title": "Judul dokumen terdeteksi",
  "detectedVariables": [
    { "variableKey": "nama_variabel", "originalSample": "teks asli di dokumen", "description": "keterangan kolom ini" }
  ],
  "staticClauses": ["Daftar klausul atau poin tetap yang baku"],
  "templateWithPlaceholders": "Teks lengkap template dengan tag {{variabel}} yang siap disimpan",
  "suggestions": ["Saran perbaikan redaksi atau kesesuaian dengan standar ILP terbaru"]
}`;

  const customCfg = p.customAgentConfig;
  if (!hasDirectAccess(customCfg)) {
    return callBackendFallback('/api/analyze-template', p);
  }

  try {
    if (customCfg && customCfg.enabled && customCfg.endpoint && (customCfg.apiKey || customCfg.noKey)) {
      const reply = await callCustomAgentText(customCfg, analyzePrompt, 0.5);
      const parsed = tryParseJson(reply);
      if (parsed) return { success: true, data: parsed, provider: 'custom' };
      return { success: false, error: 'Respon Custom AI Agent tidak valid.' };
    }
    const ai = getGeminiClient();
    const geminiResponse = await ai.models.generateContent({
      model: GEMINI_FLASH_MODEL,
      contents: analyzePrompt,
      config: {
        systemInstruction: ILP_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
      },
    });
    const parsed = tryParseJson(geminiResponse.text || '{}');
    return { success: true, data: parsed || {}, provider: 'gemini' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Gagal menganalisis dokumen template' };
  }
}

export interface AnalyzeDatabaseParams {
  documentText?: string;
  customPrompt?: string;
  currentData?: any;
  customAgentConfig?: CustomAgentConfig;
}

export async function aiAnalyzeDatabaseDocument(p: AnalyzeDatabaseParams): Promise<any> {
  if (!p.documentText && !p.currentData) {
    return { success: false, error: 'Teks dokumen atau data yang akan dianalisis tidak boleh kosong' };
  }

  const promptText = `Anda adalah Ahli Analisis Data Kesehatan & Manajemen Mutu Puskesmas ILP (Integrasi Layanan Primer) Kemenkes RI.
Tugas Anda adalah membaca dan menganalisis teks dokumen laporan, tabel capaian, notulen, atau data faskes di bawah ini, kemudian mengekstrak atau menyempurnakannya menjadi data terstruktur format Database Puskesmas.

DOKUMEN SUMBER / TEKS CAPAIAN:
"""
${(p.documentText || '').slice(0, 30000)}
"""

${p.currentData ? `DATA DRAFT SAAT INI (YANG INGIN DISEMPURNAKAN):\n${JSON.stringify(p.currentData, null, 2)}\n` : ''}

${p.customPrompt ? `INSTRUKSI KHUSUS / PERINTAH PROMPT PENGGUNA:\n"${p.customPrompt}"\nPerhatikan instruksi di atas secara saksama dalam menyusun judul, kategori, metrik, maupun rekomendasi!\n` : ''}

Format respon yang diharapkan:
PENTING: Jawab HANYA dengan JSON valid — tanpa kalimat pembuka, tanpa penjelasan, tanpa teks penutup. Langsung mulai dari karakter { dan akhiri di }.
Kembalikan respon JSON murni (JSON parsable) dengan struktur:
{
  "title": "Judul Laporan / Data Capaian (misal: Capaian SPM Kesehatan Ibu dan Anak 2025)",
  "category": "Salah satu dari: 'spm' | 'indikator_mutu' | 'capaian_program' | 'demografi_sasaran' | 'sdmk_ketenagaan' | 'sarpras_alkes' | 'surveilans_penyakit' | 'kinerja_keuangan' | 'kustom'",
  "period": "Periode data (misal: 'Tahun 2025', 'Semester II 2025', dll)",
  "klaster": "Salah satu dari: 'KLASTER_1' | 'KLASTER_2' | 'KLASTER_3' | 'KLASTER_4' | 'LINTAS_KLASTER'",
  "summary": "Ringkasan narasi yang informatif dan padat mengenai fakta data ini (2-4 kalimat)",
  "metrics": [
    {
      "key": "Nama Indikator / Butir Capaian",
      "value": "Nilai capaian ril (misal: 89.4%, 14 orang, 24,500 jiwa)",
      "target": "Nilai target jika ada (misal: 100%, 12)",
      "unit": "Satuan (misal: %, jiwa, orang, unit)",
      "status": "tercapai | belum_tercapai | dalam_pantauan"
    }
  ],
  "notes": "Catatan analisis kendala di lapangan dan rekomendasi rencana tindak lanjut (RTL)"
}`;

  const customCfg = p.customAgentConfig;
  if (!hasDirectAccess(customCfg)) {
    return callBackendFallback('/api/ai-analyze-database-document', p);
  }

  try {
    if (customCfg && customCfg.enabled && customCfg.endpoint && (customCfg.apiKey || customCfg.noKey)) {
      const reply = await callCustomAgentText(customCfg, promptText, 0.3);
      const parsed = tryParseJson(reply);
      if (parsed) return { success: true, data: parsed, provider: 'custom' };
      return { success: false, error: 'Respon Custom AI Agent tidak valid.' };
    }
    const ai = getGeminiClient();
    const geminiResponse = await ai.models.generateContent({
      model: GEMINI_FLASH_MODEL,
      contents: promptText,
      config: {
        systemInstruction: ILP_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
      },
    });
    const parsed = tryParseJson(geminiResponse.text || '{}');
    return { success: true, data: parsed || {}, provider: 'gemini' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Gagal menganalisis dokumen database dengan AI' };
  }
}

export async function aiAnalyzeDoctype(p: { sampleText: string; customAgentConfig?: CustomAgentConfig }): Promise<any> {
  if (!p.sampleText || p.sampleText.trim().length === 0) {
    return { success: false, error: 'Teks dokumen contoh tidak boleh kosong' };
  }
  const analyzePrompt = `Anda adalah Analis Tata Naskah Akreditasi Puskesmas Kemenkes RI.
Berikut adalah contoh dokumen:
"""
${p.sampleText}
"""

Tolong analisis struktur dokumen ini dan ekstrak definisi jenis tipe dokumen:
1. Nama jenis dokumen yang representatif dan baku (misal: "Notulen Rapat Mini Lokakarya", "Laporan Hasil Audit Internal", "Formulir Pemantauan Pelayanan").
2. Deskripsi singkat fungsi dokumen ini di Puskesmas atau akreditasi ILP.
3. Daftar seksi/bab/bagian utama yang ada di dokumen ini secara berurutan.

Kembalikan respon JSON terstruktur:
{
  "name": "Nama Jenis Dokumen",
  "description": "Deskripsi fungsi dokumen...",
  "defaultSections": ["Bagian 1", "Bagian 2", "Bagian 3"]
}`;

  const customCfg = p.customAgentConfig;
  if (!hasDirectAccess(customCfg)) {
    return callBackendFallback('/api/analyze-doctype', p);
  }

  try {
    const ai = getGeminiClient();
    const geminiResponse = await ai.models.generateContent({
      model: GEMINI_FLASH_MODEL,
      contents: analyzePrompt,
      config: {
        systemInstruction: ILP_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
      },
    });
    const parsed = tryParseJson(geminiResponse.text || '{}');
    return { success: true, data: parsed || {}, provider: 'gemini' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Gagal menganalisis tipe dokumen' };
  }
}
