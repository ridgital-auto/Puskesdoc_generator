/**
 * appGuide.ts — Basis pengetahuan tentang aplikasi Puskesdoc Generator,
 * dipakai oleh fitur "Tanya AI" di modal Bantuan.
 */
import { getGeminiClient, GEMINI_FLASH_MODEL, AI_KEY_HELP } from './aiAgent';

/**
 * Alur login Google Drive terbaru (Okt 2026): SATU KLIK.
 * - Pengguna cukup klik "Masuk dengan Google" di tab Google Drive.
 * - Aplikasi memakai OAuth Client ID bersama yang sudah ditanam di kode.
 * - Setelah izin diberikan: aplikasi OTOMATIS mencari puskesdoc_full_backup.json
 *   di Drive pengguna → bila ada langsung dipulihkan → Auto-Sync diaktifkan.
 * - Di perangkat baru: login akun Google yang sama → data otomatis ikut.
 * - Tidak perlu lagi membuat / mengisi OAuth Client ID sendiri.
 * - Agar email lain bisa login: pengelola menambahkan email tsb sebagai Test user
 *   di Google Cloud Console → OAuth consent screen (atau Publish app).
 */
/**
 * Pembaruan Okt 2026 (default kosong & fitur baru):
 * - Database Puskesmas, Pustaka Media, dan Profil Faskes kini mulai KOSONG secara
 *   default; pengguna mengisi data milik faskesnya sendiri.
 * - Template: upload Word kini tampil persis sesuai aslinya (high-fidelity) dan
 *   bisa langsung diedit di preview (klik teksnya). Form template memiliki kolom
 *   "Kategori Template" (mis. SOP, SK, Dokumen Word Asli).
 * - Database: tab "Ekstraksi AI dari Berkas" — unggah .docx, lihat "Preview Dokumen
 *   Asli", klik Ekstrak → hasil tampil sebagai preview rapi; bisa "Generate Ulang"
 *   dengan perintah perbaikan, "Edit Manual di Form", atau "Simpan ke Database".
 */
export const APP_GUIDE_KNOWLEDGE = `
# Panduan Aplikasi Puskesdoc Generator

## Apa itu aplikasi ini?
Puskesdoc Generator adalah aplikasi pembuat dokumen akreditasi Puskesmas berbasis AI (Google Gemini 3.8 Flash).
Dokumen yang bisa dibuat: SOP, SK (Surat Keputusan), KAK (Kerangka Acuan Kerja), Pedoman, Panduan, Notulen, dan jenis dokumen custom lainnya — semuanya mengikuti standar Integrasi Layanan Primer (ILP) Kemenkes RI (Klaster 1 s/d 5).

## Menu / Tab Utama
1. **Generator** — Membuat dokumen baru dengan AI. Pilih jenis dokumen & klaster ILP, tulis judul, konteks, dan instruksi tambahan, lalu klik Generate. Hasilnya bisa diedit per bagian di lembar kerja.
2. **Pustaka Template** — Menyimpan dan mengelola template dokumen. Template berisi teks dengan placeholder variabel seperti {{nama_kegiatan}} yang otomatis terisi dari data Variabel.
3. **Variabel** — Daftar data faskes (nama puskesmas, kepala puskesmas, NIP, alamat, dll) yang otomatis disisipkan ke dokumen via placeholder {{nama_variabel}}.
4. **Database Puskesmas** — Menyimpan data capaian (SPM, indikator mutu, capaian program, demografi, SDM, sarpras, surveilans, keuangan). Bisa diisi manual atau dianalisis otomatis oleh AI dari file laporan (Word/teks/CSV). Data terpilih ikut menjadi dasar naskah saat generate dokumen.
5. **Pustaka Media** — Menyimpan file pendukung (dokumen Word hasil generate, gambar, dll).
6. **Profil Faskes** — Data identitas puskesmas (nama, alamat, kepala, NIP) yang tampil di kop dokumen.

## Cara Membuat Dokumen (langkah-langkah)
1. Buka tab Generator.
2. Pilih jenis dokumen (SOP/SK/KAK/Pedoman/Panduan/Custom) dan Klaster ILP.
3. Isi judul dokumen, konteks/alur khusus, dan instruksi tambahan bila perlu.
4. Atur target jumlah halaman.
5. Pilih data Database Puskesmas yang relevan (opsional, tapi disarankan agar angka capaian masuk ke naskah).
6. Klik tombol Generate (mis. "Buat Dokumen"). Tunggu AI menyusun naskah.
7. Edit hasilnya di lembar kerja, lalu unduh sebagai Word (.docx) atau cetak.

## Perintah dalam kurung siku [...]
Teks di dalam tanda [..] pada judul/konteks/instruksi adalah PERINTAH KHUSUS untuk AI. Contoh: [rincikan alur pemeriksaan ANC 6x]. AI akan menjalankan perintah itu dan mengganti tanda [..] dengan naskah jadi. Di lembar kerja, tiap bagian yang masih mengandung [..] bisa dieksekusi satu per satu dengan tombol khusus.

## Pengaturan AI Agent (Backup & GDrive → tab AI Agent)
- **API Key Gemini Pribadi (wajib)**: tempel API key dari https://aistudio.google.com/apikey (gratis). Key hanya tersimpan di browser ini. Tanpa ini AI tidak bisa dipakai di link preview.
- **Custom AI Agent (opsional)**: untuk memakai OpenAI/Groq/OpenRouter/server sendiri via endpoint yang kompatibel Chat Completions.

## Ukuran Kertas
Di toolbar (dekat tombol .DOCX) ada pilihan ukuran kertas: A4, F4/Folio, Letter, Legal, dan Custom (isi lebar × tinggi dalam mm). Berlaku untuk semua ekspor Word.

## Ekspor & Cetak
- Tombol **.DOCX**: mengunduh dokumen aktif sebagai file Microsoft Word.
- Tombol **Cetak**: mencetak langsung / simpan sebagai PDF.
- Di pratinjau hasil generate ada tombol **Unduh .DOCX** dan **Simpan ke Media**.

## Backup, Restore & Google Drive (tombol Backup & GDrive, ikon awan)
- **Tab Google Drive**: tautkan akun Google memakai OAuth Client ID milik sendiri (panduan ada di tab tersebut), lalu bisa menyimpan dokumen & cadangan ke folder "Akreditasi Puskesmas ILP 2026" di Drive, serta sinkronisasi otomatis.
- **Tab Backup & Restore**: unduh cadangan (.json) berisi SEMUA data (profil, variabel, dokumen, template, database, termasuk API key Gemini) — berguna saat ganti perangkat/HP. Untuk pulihkan, pilih file .json cadangan lalu data kembali seperti semula.

## Login Email
Tombol "Login Email" untuk masuk dengan akun Google via Firebase. Tidak wajib untuk memakai AI (cukup API key Gemini).

## Batasan
- Aplikasi ini adalah preview statis (GitHub Pages): AI memanggil Google Gemini langsung dari browser memakai API key milik pengguna.
- Jika AI error, periksa: (1) API key sudah diisi dan benar, (2) koneksi internet, (3) kuota gratis Gemini di akunmu belum habis.
`;

const APP_GUIDE_SYSTEM = `Kamu adalah asisten bantuan untuk aplikasi "Puskesdoc Generator".
Jawab pertanyaan pengguna SEPUTAR CARA PENGGUNAAN aplikasi ini saja, dengan bahasa Indonesia yang ramah, sederhana, dan langkah-langkah bernomor bila perlu.
Gunakan basis pengetahuan berikut sebagai acuan utama. Jika pertanyaan di luar topik aplikasi, jawab singkat bahwa kamu hanya bisa membantu seputar penggunaan aplikasi ini.

BASIS PENGETAHUAN:
${APP_GUIDE_KNOWLEDGE}`;

export async function aiAskAboutApp(question: string): Promise<{ success: boolean; answer?: string; error?: string }> {
  const q = (question || '').trim();
  if (!q) return { success: false, error: 'Tulis dulu pertanyaanmu.' };
  try {
    const ai = getGeminiClient();
    const resp = await ai.models.generateContent({
      model: GEMINI_FLASH_MODEL,
      contents: `Pertanyaan pengguna: ${q}`,
      config: { systemInstruction: APP_GUIDE_SYSTEM },
    });
    const answer = resp.text?.trim() || '';
    if (!answer) return { success: false, error: 'AI tidak memberikan jawaban. Coba lagi.' };
    return { success: true, answer };
  } catch (error: any) {
    if (error?.message === AI_KEY_HELP) return { success: false, error: AI_KEY_HELP };
    return { success: false, error: error.message || 'Gagal bertanya ke AI.' };
  }
}
