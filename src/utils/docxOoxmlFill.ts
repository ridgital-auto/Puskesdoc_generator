/**
 * docxOoxmlFill.ts — Isi penanda [...] LANGSUNG di berkas .docx asli.
 *
 * Untuk mode isi-template, unduhan TERBAIK adalah memodifikasi file Word
 * asli pengguna (bukan mengkonversi HTML): tabel, kop, header/footer,
 * gambar, dan pagination 100% sama persis seperti aslinya — hanya teks
 * di dalam [...] yang diganti dengan isian AI.
 *
 * Cara kerja:
 *  1. Buka .docx (ZIP) → ambil word/document.xml.
 *  2. Untuk tiap <w:p>, gabungkan teks dari <w:t> (dengan peta offset).
 *  3. Cari penanda [teks] sesuai urutan, ganti dengan isian (mendukung
 *     ganti baris → <w:br/>; format run dipertahankan).
 *  4. Simpan kembali ke ZIP → Blob .docx siap unduh.
 */
import JSZip from 'jszip';

export interface OoxmlFill {
  /** Teks asli di dalam [...] (tanpa kurung siku) */
  marker: string;
  /** Teks pengganti dari AI */
  text: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Buat pola fleksibel: spasi di penanda boleh beda jumlah di XML. */
function markerPattern(marker: string): RegExp {
  const flex = escapeRegExp(marker).replace(/\s+/g, '\\s+');
  return new RegExp(`\\[\\s*${flex}\\s*\\]`);
}

interface TextNodeMap {
  el: Element;
  start: number;
  end: number;
}

function setPreserve(el: Element): void {
  el.setAttribute('xml:space', 'preserve');
}

/**
 * Ganti rentang [start, end) pada peta w:t dengan teks pengganti.
 * Mendukung \n → <w:br/> di dalam run yang sama (format dipertahankan).
 */
function replaceRange(xmlDoc: XMLDocument, nodes: TextNodeMap[], start: number, end: number, replacement: string): boolean {
  const hits = nodes.filter((n) => n.start < end && n.end > start);
  if (hits.length === 0) return false;
  const first = hits[0];
  const last = hits[hits.length - 1];
  const before = (first.el.textContent || '').slice(0, Math.max(0, start - first.start));
  const after = (last.el.textContent || '').slice(Math.max(0, end - last.start));
  // Kosongkan node tengah
  for (let i = 1; i < hits.length; i++) hits[i].el.textContent = '';

  const lines = replacement.split('\n');
  first.el.textContent = before + lines[0];
  setPreserve(first.el);

  const rEl = first.el.parentNode;
  let refNode: Node = first.el;
  if (rEl) {
    for (let i = 1; i < lines.length; i++) {
      const br = xmlDoc.createElement('w:br');
      const nt = xmlDoc.createElement('w:t');
      setPreserve(nt);
      nt.textContent = lines[i];
      rEl.insertBefore(br, refNode.nextSibling);
      rEl.insertBefore(nt, br.nextSibling);
      refNode = nt;
    }
  } else if (lines.length > 1) {
    // Fallback: tanpa <w:br/>, gabung dengan spasi
    first.el.textContent = before + lines.join(' ');
    return true;
  }
  if (after) {
    const target = refNode as Element;
    target.textContent = (target.textContent || '') + after;
    setPreserve(target);
  }
  return true;
}

/**
 * Isi semua penanda [...] di dalam berkas .docx (base64) sesuai urutan.
 * Mengembalikan Blob .docx yang siap diunduh.
 */
export async function fillDocxOoxml(base64: string, fills: OoxmlFill[]): Promise<Blob> {
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('word/document.xml tidak ditemukan di berkas.');
  const xmlText = await docFile.async('string');

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
  if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Gagal membaca struktur dokumen Word.');
  }

  const body = xmlDoc.getElementsByTagName('w:body')[0];
  if (!body) throw new Error('Isi dokumen (w:body) tidak ditemukan.');
  const paragraphs = Array.from(body.getElementsByTagName('w:p'));

  let searchFrom = 0; // indeks paragraf mulai pencarian (penanda dicari berurutan)
  for (const fill of fills) {
    const pattern = markerPattern(fill.marker);
    let done = false;
    for (let pi = searchFrom; pi < paragraphs.length && !done; pi++) {
      const p = paragraphs[pi];
      const tEls = Array.from(p.getElementsByTagName('w:t'));
      if (tEls.length === 0) continue;
      // Bangun teks gabungan + peta offset
      let text = '';
      const nodes: TextNodeMap[] = [];
      for (const el of tEls) {
        const t = el.textContent || '';
        nodes.push({ el, start: text.length, end: text.length + t.length });
        text += t;
      }
      pattern.lastIndex = 0;
      const m = pattern.exec(text);
      if (m && m.index !== undefined) {
        const s = m.index;
        const e = s + m[0].length;
        if (replaceRange(xmlDoc, nodes, s, e, fill.text || '')) {
          done = true;
          searchFrom = pi; // penanda berikutnya dicari dari sini (urutan dokumen)
        }
      }
    }
    // Penanda yang tidak ketemu dilewati (tidak menggagalkan unduhan)
  }

  const serializer = new XMLSerializer();
  const newXml = serializer.serializeToString(xmlDoc);
  zip.file('word/document.xml', newXml);
  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  });
}

/** Unduh Blob sebagai berkas dengan nama tertentu. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}
