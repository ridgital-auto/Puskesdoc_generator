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

  // Deteksi list bernomor: SEBUAH baris diawali "N." (toleran spasi & kurung).
  // Bila >=2 baris seperti itu -> list: strip angka AI, pakai numbering Word.
  // PENTING: AI sering menomori LANJUT antar sel (6., 7., ...) — angka-angkanya
  // dibuang, lalu numId baru membuat Word tampilkan 1,2,3 dari awal tiap sel.
  const numRe = /^\s*\d{1,3}[.)]\s+/;
  const stripNum = (s: string) => s.replace(/^\s*\d{1,3}[.)]\s+/, '');
  const numberedCount = lines.filter((ln) => numRe.test(ln)).length;
  const isNumberedList = lines.length > 1 && numberedCount >= 2;
  const listNumId = isNumberedList ? nextNumId() : undefined;

  // Fungsi bantu: buat elemen <w:numPr> untuk paragraf
  const makeNumPr = (doc: XMLDocument, ilvl: number, numId: number): Element => {
    const numPr = doc.createElement('w:numPr');
    const ilvlEl = doc.createElement('w:ilvl');
    ilvlEl.setAttribute('w:val', String(ilvl));
    const numIdEl = doc.createElement('w:numId');
    numIdEl.setAttribute('w:val', String(numId));
    numPr.appendChild(ilvlEl);
    numPr.appendChild(numIdEl);
    return numPr;
  };
  // Sisipkan numPr ke pPr (buat pPr bila belum ada); kembalikan pPr.
  const applyNumPr = (p: Element, pPrEl: Element | null): Element => {
    let target = pPrEl;
    if (!target) {
      target = xmlDoc.createElement('w:pPr');
      p.insertBefore(target, p.firstChild);
    }
    // Hapus numPr lama, tambah yang baru
    const olds = target.getElementsByTagName('w:numPr');
    for (let j = olds.length - 1; j >= 0; j--) olds[j].parentNode?.removeChild(olds[j]);
    if (listNumId !== undefined) target.appendChild(makeNumPr(xmlDoc, 0, listNumId));
    return target;
  };

  // Baris pertama tetap di paragraf asal
  first.el.textContent = before + (isNumberedList ? stripNum(lines[0]) : lines[0]);
  setPreserve(first.el);

  const pPr = pEl.getElementsByTagName('w:pPr')[0];
  const rEl = first.el.parentNode as Element | null;
  const rPr = rEl ? (rEl.getElementsByTagName('w:rPr')[0] as Element) : null;
  // Warna merah penanda [...] jangan ikut ke isian
  stripMarkerColor(rPr);
  const parent = pEl.parentNode;
  let insertAfter: Node = pEl;

  // Terapkan numbering ke paragraf pertama bila list bernomor
  if (isNumberedList) {
    applyNumPr(pEl, pPr || null);
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
    if (isNumberedList) {
      // Pastikan ada pPr, lalu terapkan numPr (hapus numPr warisan dulu)
      if (!newPPr) {
        newPPr = xmlDoc.createElement('w:pPr');
        newP.insertBefore(newPPr, newP.firstChild);
      }
      const olds = newPPr.getElementsByTagName('w:numPr');
      for (let j = olds.length - 1; j >= 0; j--) olds[j].parentNode?.removeChild(olds[j]);
      if (listNumId !== undefined) newPPr.appendChild(makeNumPr(xmlDoc, 0, listNumId));
    } else if (newPPr) {
      // Bukan list: jangan warisi penomoran otomatis dari template
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
    newT.textContent = (isNumberedList ? stripNum(lines[i]) : lines[i]) + (isLast ? after : '');
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
 * Menambah 1 abstractNum (desimal) + N <w:num> ke word/numbering.xml,
 * lalu mengembalikan daftar numId yang boleh dipakai (tiap list pakai
 * numId sendiri agar penomoran selalu mulai dari 1).
 */
async function ensureNumbering(zip: JSZip, count: number): Promise<number[]> {
  const numFile = zip.file('word/numbering.xml');
  if (!numFile) return []; // tanpa numbering.xml, lewati (fallback teks)
  let nxml = await numFile.async('string');

  // Cari id maksimum yang sudah ada
  const absIds = [...nxml.matchAll(/w:abstractNumId="(\d+)"/g)].map(m => parseInt(m[1], 10));
  const numIds = [...nxml.matchAll(/<w:num w:numId="(\d+)"/g)].map(m => parseInt(m[1], 10));
  const newAbs = (absIds.length ? Math.max(...absIds) : 0) + 1;
  let nextNum = (numIds.length ? Math.max(...numIds) : 0) + 1;

  const lvl =
    '<w:lvl w:ilvl="0" w:tplc="0409000F" w:xfib="1">' +
    '<w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/>' +
    '<w:lvlPicBulletId w:val="0"/><w:legacy w:legacy="1" w:legacySpace="360" w:legacyIndent="360"/>' +
    '<w:lvlJc w:val="left"/>' +
    '<w:pPr><w:ind w:left="360" w:hanging="360"/></w:pPr>' +
    '<w:rPr><w:rFonts w:hint="default"/></w:rPr></w:lvl>';
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

  // abstractNum harus sebelum <w:num>; sisipkan absEl sebelum num pertama,
  // dan numEls sebelum penutup </w:numbering>
  const firstNumIdx = nxml.indexOf('<w:num ');
  if (firstNumIdx >= 0) nxml = nxml.slice(0, firstNumIdx) + absEl + nxml.slice(firstNumIdx);
  else nxml = nxml.replace('</w:numbering>', absEl + '</w:numbering>');
  nxml = nxml.replace('</w:numbering>', numEls + '</w:numbering>');
  zip.file('word/numbering.xml', nxml);
  return result;
}

// numId yang sedang aktif (dialokasikan per pemanggilan fillDocxOoxml)
let gNumIds: number[] = [];
let gNumIdx = 0;
export function nextNumId(): number | undefined {
  if (gNumIdx >= gNumIds.length) return undefined;
  return gNumIds[gNumIdx++];
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
  // Siapkan penomoran Word untuk isian bernomor (tiap fill = list sendiri)
  gNumIds = await ensureNumbering(zip, 40);
  gNumIdx = 0;
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
