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

  // Bersihkan isian AI: buang kurung siku pembungkus luar bila AI mengembalikannya
  // (mis. "[isi konten...]" -> "isi konten..."). Jangan sentuh kurung di tengah.
  let cleanReplacement = replacement.trim();
  if (cleanReplacement.startsWith('[') && cleanReplacement.endsWith(']') && !cleanReplacement.slice(1, -1).includes('[')) {
    cleanReplacement = cleanReplacement.slice(1, -1).trim();
  }
  const lines = cleanReplacement.split('\n');
  const pEl = findAncestor(first.el, 'w:p');

  if (lines.length === 1 || !pEl || !pEl.parentNode) {
    // Satu baris: ganti di tempat; hapus warna penanda
    const rElSingle = first.el.parentNode as Element | null;
    stripMarkerColor(rElSingle ? rElSingle.getElementsByTagName('w:rPr')[0] : null);
    first.el.textContent = before + lines.join(' ') + after;
    setPreserve(first.el);
    return true;
  }

  // Deteksi list bernomor: baris diawali "N." (toleran spasi & kurung).
  // Bila >=2 baris seperti itu -> jadikan LIST NUMBERING Word betulan:
  // strip angka teks AI, lalu pasang <w:numPr> dengan numId baru
  // (tiap isian = list terpisah -> selalu mulai dari 1).
  // Bila numbering tak tersedia (tak ada numbering.xml), fallback: renumber teks.
  const numRe = /^\s*\d{1,3}[.)]\s+/;
  const numberedIdx: number[] = [];
  lines.forEach((ln, i) => { if (numRe.test(ln)) numberedIdx.push(i); });
  const isNumberedList = lines.length > 1 && numberedIdx.length >= 2;
  const listNumId = isNumberedList ? allocNumId() : undefined;
  const useWordNumbering = isNumberedList && listNumId !== undefined;
  if (isNumberedList) {
    if (useWordNumbering) {
      for (const i of numberedIdx) lines[i] = lines[i].replace(/^\s*\d{1,3}[.)]\s+/, '');
    } else {
      let n = 1;
      for (const i of numberedIdx) lines[i] = lines[i].replace(/^\s*\d{1,3}[.)]\s+/, `${n++}. `);
    }
  }

  // Bantu: beri/buang <w:numPr> pada pPr paragraf tertentu
  const setNumPr = (p: Element, pPrEl: Element | null, numId: number | null): void => {
    let target = pPrEl;
    if (!target) {
      target = xmlDoc.createElement('w:pPr');
      p.insertBefore(target, p.firstChild);
    }
    const olds = target.getElementsByTagName('w:numPr');
    for (let j = olds.length - 1; j >= 0; j--) olds[j].parentNode?.removeChild(olds[j]);
    if (numId !== null) {
      const numPr = xmlDoc.createElement('w:numPr');
      const ilvlEl = xmlDoc.createElement('w:ilvl');
      ilvlEl.setAttribute('w:val', '0');
      const numIdEl = xmlDoc.createElement('w:numId');
      numIdEl.setAttribute('w:val', String(numId));
      numPr.appendChild(ilvlEl);
      numPr.appendChild(numIdEl);
      target.appendChild(numPr);
    }
  };

  // Baris pertama tetap di paragraf asal
  first.el.textContent = before + lines[0];
  setPreserve(first.el);

  const pPr = pEl.getElementsByTagName('w:pPr')[0];
  const rEl = first.el.parentNode as Element | null;
  const rPr = rEl ? (rEl.getElementsByTagName('w:rPr')[0] as Element) : null;
  // Warna merah penanda [...] jangan ikut ke isian
  stripMarkerColor(rPr);
  const parent = pEl.parentNode;
  let insertAfter: Node = pEl;

  // Paragraf pertama: bila baris 0 termasuk list -> pasang numPr
  if (useWordNumbering && numberedIdx.includes(0)) {
    setNumPr(pEl, pPr || null, listNumId!);
  }

  for (let i = 1; i < lines.length; i++) {
    const isLast = i === lines.length - 1;
    const newP = xmlDoc.createElement('w:p');
    let newPPr: Element | null = null;
    if (pPr) {
      const pPrClone = pPr.cloneNode(true) as Element;
      newPPr = pPrClone;
      newP.appendChild(pPrClone);
    }
    // Atur numPr paragraf baru: anggota list -> numId sama; bukan -> tanpa numPr
    if (useWordNumbering) {
      setNumPr(newP, newPPr, numberedIdx.includes(i) ? listNumId! : null);
      // setNumPr membuat pPr baru bila sebelumnya tak ada; catat referensinya
      newPPr = newP.getElementsByTagName('w:pPr')[0] || newPPr;
    } else if (newPPr) {
      // Jangan warisi penomoran otomatis template
      const numPrs = newPPr.getElementsByTagName('w:numPr');
      for (let j = numPrs.length - 1; j >= 0; j--) {
        const np = numPrs[j];
        np.parentNode?.removeChild(np);
      }
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
 * Siapkan definisi penomoran Word untuk isian AI.
 * Menambah 1 abstractNum (desimal, struktur PERSIS seperti template asli:
 * lvl hanya berisi start/numFmt/lvlText/lvlJc/pPr — tanpa elemen liar)
 * + N <w:num>, lalu kembalikan daftar numId yang boleh dipakai.
 */
async function ensureNumbering(zip: JSZip, count: number): Promise<number[]> {
  const numFile = zip.file('word/numbering.xml');
  if (!numFile) return [];
  let nxml = await numFile.async('string');
  if (!nxml.includes('</w:numbering>')) return [];

  const absIds = [...nxml.matchAll(/w:abstractNumId="(\d+)"/g)].map((m) => parseInt(m[1], 10));
  const numIds = [...nxml.matchAll(/<w:num w:numId="(\d+)"/g)].map((m) => parseInt(m[1], 10));
  const newAbs = (absIds.length ? Math.max(...absIds) : 0) + 1;
  let nextNum = (numIds.length ? Math.max(...numIds) : 0) + 1;

  const lvl =
    '<w:lvl w:ilvl="0" w:tplc="04090019" w:xfib="1">' +
    '<w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/>' +
    '<w:lvlJc w:val="left"/><w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr></w:lvl>';
  const absEl =
    `<w:abstractNum w:abstractNumId="${newAbs}">` +
    '<w:nsid w:val="713259D5"/><w:multiLevelType w:val="singleLevel"/>' +
    '<w:tmpl w:val="04090019"/>' + lvl + '</w:abstractNum>';

  const result: number[] = [];
  let numEls = '';
  for (let i = 0; i < count; i++) {
    const id = nextNum++;
    result.push(id);
    numEls += `<w:num w:numId="${id}"><w:abstractNumId w:val="${newAbs}"/></w:num>`;
  }
  // abstractNum WAJIB sebelum semua <w:num>
  const firstNumIdx = nxml.indexOf('<w:num ');
  if (firstNumIdx >= 0) nxml = nxml.slice(0, firstNumIdx) + absEl + nxml.slice(firstNumIdx);
  else nxml = nxml.replace('</w:numbering>', absEl + '</w:numbering>');
  nxml = nxml.replace('</w:numbering>', numEls + '</w:numbering>');
  zip.file('word/numbering.xml', nxml);
  return result;
}

// Alokasi numId per pemanggilan fillDocxOoxml (tiap list = numId sendiri)
let numberingPool: number[] = [];
let numberingIdx = 0;
function allocNumId(): number | undefined {
  return numberingIdx < numberingPool.length ? numberingPool[numberingIdx++] : undefined;
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
  numberingPool = await ensureNumbering(zip, 40);
  numberingIdx = 0;
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

  // Bersihkan sisa penanda yang tidak terisi: [[FILL_n]] maupun [...] mentah
  // jangan sampai muncul di dokumen akhir.
  const leftover = /\[\[\s*FILL_\d+\s*\]\]|\[[^\[\]]{0,80}\]/g;
  for (const p of paragraphs) {
    const tEls = Array.from(p.getElementsByTagName('w:t'));
    for (const tEl of tEls) {
      const t = tEl.textContent || '';
      if (leftover.test(t)) {
        leftover.lastIndex = 0;
        tEl.textContent = t.replace(leftover, '').replace(/\s{2,}/g, ' ');
        leftover.lastIndex = 0;
      }
    }
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
