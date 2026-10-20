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
  // marker sudah berpola "[[FILL_n]]" — cukup escape, jangan bungkus \[ \] lagi.
  return new RegExp(escapeRegExp(marker).replace(/\s+/g, '\\s+'));
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
 *
 * Teks multi-baris (\n) dipecah menjadi PARAGRAF Word baru (<w:p>), BUKAN
 * <w:br/>. Alasannya: <w:br/> di dalam paragraf rata kanan-kiri (justify)
 * membuat tiap baris ter-stretch penuh (jelek). Paragraf baru mewarisi
 * <w:pPr> (format paragraf) dan <w:rPr> (format huruf) aslinya.
 */
function replaceRange(xmlDoc: XMLDocument, nodes: TextNodeMap[], start: number, end: number, replacement: string): boolean {
  const hits = nodes.filter((n) => n.start < end && n.end > start);
  if (hits.length === 0) return false;
  const first = hits[0];
  const last = hits[hits.length - 1];
  const before = (first.el.textContent || '').slice(0, Math.max(0, start - first.start));
  const after = (last.el.textContent || '').slice(Math.max(0, end - last.start));
  // Kosongkan node yang tertimpa selain pertama
  for (let i = 1; i < hits.length; i++) hits[i].el.textContent = '';

  const lines = replacement.split('\n');
  const pEl = findAncestor(first.el, 'w:p');

  if (lines.length === 1 || !pEl || !pEl.parentNode) {
    // Satu baris: ganti di tempat; hapus warna penanda
    const rElSingle = first.el.parentNode as Element | null;
    stripMarkerColor(rElSingle ? rElSingle.getElementsByTagName('w:rPr')[0] : null);
    first.el.textContent = before + lines.join(' ') + after;
    setPreserve(first.el);
    return true;
  }

  // Baris pertama tetap di paragraf asal
  first.el.textContent = before + lines[0];
  setPreserve(first.el);

  const pPr = pEl.getElementsByTagName('w:pPr')[0];
  const rEl = first.el.parentNode as Element | null;
  const rPr = rEl ? rEl.getElementsByTagName('w:rPr')[0] : null;
  // Warna merah penanda [...] jangan ikut ke isian
  stripMarkerColor(rPr);
  const parent = pEl.parentNode;
  let insertAfter: Node = pEl;

  for (let i = 1; i < lines.length; i++) {
    const isLast = i === lines.length - 1;
    const newP = xmlDoc.createElement('w:p');
    if (pPr) {
      const pPrClone = pPr.cloneNode(true) as Element;
      // Jangan warisi penomoran otomatis (w:numPr) — isian AI sudah membawa
      // penomorannya sendiri sebagai teks biasa (a., b., 1., 2.).
      const numPrs = pPrClone.getElementsByTagName('w:numPr');
      for (let j = numPrs.length - 1; j >= 0; j--) {
        const np = numPrs[j];
        np.parentNode?.removeChild(np);
      }
      newP.appendChild(pPrClone);
    }
    const newR = xmlDoc.createElement('w:r');
    if (rPr) newR.appendChild(rPr.cloneNode(true));
    const newT = xmlDoc.createElement('w:t');
    setPreserve(newT);
    newT.textContent = lines[i] + (isLast ? after : '');
    newR.appendChild(newT);
    newP.appendChild(newR);
    parent.insertBefore(newP, insertAfter.nextSibling);
    insertAfter = newP;
  }
  return true;
}

/** Hapus warna/highlight penanda dari properti run — warna [...] hanya
 *  penanda visual bagi penulis template, bukan warna isi dokumen. */
function stripMarkerColor(rPr: Element | null | undefined): void {
  if (!rPr) return;
  const colors = rPr.getElementsByTagName('w:color');
  for (let i = colors.length - 1; i >= 0; i--) {
    const c = colors[i];
    c.parentNode?.removeChild(c);
  }
  const highlights = rPr.getElementsByTagName('w:highlight');
  for (let i = highlights.length - 1; i >= 0; i--) {
    const h = highlights[i];
    h.parentNode?.removeChild(h);
  }
}

/** Cari elemen leluhur dengan nama tag tertentu. */
function findAncestor(el: Element, tag: string): Element | null {
  let cur: Node | null = el.parentNode;
  while (cur) {
    if ((cur as Element).tagName === tag) return cur as Element;
    cur = cur.parentNode;
  }
  return null;
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

/** Ubah Blob menjadi string base64 (tanpa prefix data:). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const url = reader.result as string;
      resolve(url.includes(',') ? url.split(',')[1] : url);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Ubah string base64 menjadi Blob. */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
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
