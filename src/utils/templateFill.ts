/**
 * templateFill.ts — Mode "isi template": AI HANYA mengisi bagian bertanda [...].
 *
 * Prinsip kerja (sesuai permintaan pengguna):
 *  1. Template adalah dokumen Word asli (tabel, kop, dsb) yang berisi penanda [...].
 *  2. Setiap [...] diganti placeholder [[FILL_n]] (struktur tabel & format TIDAK diubah).
 *  3. AI hanya diminta menulis isi untuk setiap nomor — balasannya JSON {fills: {n: teks}}.
 *  4. Isian dimasukkan kembali ke HTML tepat di posisi placeholder.
 *  5. Variabel {{kunci}} yang nilainya sudah dikenal ikut disubstitusi langsung.
 */

export interface FillMarker {
  id: number;
  /** Teks asli di dalam [...], sebagai petunjuk untuk AI */
  original: string;
}

export interface PreparedTemplate {
  /** HTML dengan [...] sudah menjadi [[FILL_n]] dan {{var}} dikenal sudah terisi */
  placeholderHtml: string;
  /** Versi teks biasa untuk dikirim ke AI */
  plainTemplate: string;
  markers: FillMarker[];
}

const BRACKET_RE = /\[([^\[\]\n\r]{1,300})\]/g;

function decodeEntities(s: string): string {
  const ta = document.createElement('textarea');
  ta.innerHTML = s;
  return ta.value;
}

/** Ubah HTML jadi teks biasa dengan baris yang wajar (untuk konteks AI). */
export function htmlToPlainText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h1|h2|h3|h4|h5|h6|table|section|header|footer)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(withBreaks)
    .replace(/&nbsp;/gi, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Siapkan template untuk diisi AI. Kembalikan null bila tidak ada [...]
 * yang perlu diisi.
 *
 * PENTING: teks Word (docx-preview) dipecah menjadi banyak text-node
 * (satu per run). Marker panjang seperti "[Definisi/pengertian ...]"
 * hampir pasti TERPOTONG antar text-node, sehingga regex per-node gagal.
 * Karena itu deteksi dilakukan per BLOK (p/div/td/dll): seluruh teks blok
 * digabung dulu, baru dicari [...], lalu rentang yang cocok diganti
 * lintas node.
 */
export function prepareTemplateForFill(
  html: string,
  variables: Record<string, any>,
): PreparedTemplate | null {
  const root = document.createElement('div');
  root.innerHTML = html;

  const markers: FillMarker[] = [];
  let counter = 0;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  // 1) Substitusi variabel {{kunci}} yang nilainya sudah ada (per text-node, aman)
  for (const tn of textNodes) {
    const parent = tn.parentElement;
    if (!parent || /^(SCRIPT|STYLE)$/.test(parent.tagName)) continue;
    const replaced = (tn.nodeValue || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, key: string) => {
      const v = variables[key];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
      return full;
    });
    if (replaced !== tn.nodeValue) tn.nodeValue = replaced;
  }

  // 2) Kelompokkan text-node per blok terdekat agar [...] yang terpotong
  //    antar run tetap ketemu, tapi tidak bocor antar paragraf.
  const BLOCK_SEL = 'p,div,li,td,th,h1,h2,h3,h4,h5,h6,section,article,header,footer,blockquote,pre';
  const groups = new Map<Element, Text[]>();
  for (const tn of textNodes) {
    const parent = tn.parentElement;
    if (!parent || /^(SCRIPT|STYLE)$/.test(parent.tagName)) continue;
    if (!tn.nodeValue) continue;
    const block = parent.closest(BLOCK_SEL) || root;
    const arr = groups.get(block);
    if (arr) arr.push(tn); else groups.set(block, [tn]);
  }

  for (const [, nodes] of groups) {
    // Gabungkan teks blok + peta offset -> node
    let full = '';
    const map: { node: Text; start: number; end: number }[] = [];
    for (const tn of nodes) {
      const t = tn.nodeValue || '';
      if (!t) continue;
      map.push({ node: tn, start: full.length, end: full.length + t.length });
      full += t;
    }
    if (!full.includes('[')) continue;

    // Cari semua [...] (urutan dokumen)
    BRACKET_RE.lastIndex = 0;
    const matches: { index: number; end: number; inner: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = BRACKET_RE.exec(full)) !== null) {
      const innerTrim = m[1].trim();
      if (!innerTrim || /^\s*FILL_\d+\s*$/.test(innerTrim)) continue;
      matches.push({ index: m.index, end: m.index + m[0].length, inner: innerTrim });
    }
    if (matches.length === 0) continue;

    // Terapkan dari BELAKANG agar offset depan tetap valid.
    // ID ditetapkan sesuai urutan kemunculan di dokumen.
    const base = counter;
    counter += matches.length;
    for (let i = matches.length - 1; i >= 0; i--) {
      const mt = matches[i];
      const id = base + i + 1;
      markers.push({ id, original: mt.inner });
      replaceRangeWith(map, mt.index, mt.end, `[[FILL_${id}]]`);
    }
  }

  if (markers.length === 0) return null;
  // Urutkan marker sesuai urutan kemunculan di dokumen
  markers.sort((a, b) => a.id - b.id);

  const placeholderHtml = root.innerHTML;
  const plainTemplate = htmlToPlainText(placeholderHtml).slice(0, 8000);
  return { placeholderHtml, plainTemplate, markers };
}

/** Ganti rentang karakter [startIdx, endIdx) pada peta text-node dengan teks baru. */
function replaceRangeWith(
  map: { node: Text; start: number; end: number }[],
  startIdx: number,
  endIdx: number,
  replacement: string,
): void {
  let startEntry: { node: Text; start: number; end: number } | null = null;
  let endEntry: { node: Text; start: number; end: number } | null = null;
  for (const e of map) {
    if (!startEntry && startIdx >= e.start && startIdx < e.end) startEntry = e;
    if (endIdx > e.start && endIdx <= e.end) endEntry = e;
    if (startEntry && endEntry) break;
  }
  if (!startEntry || !endEntry) return;
  const startOff = startIdx - startEntry.start;
  const endOff = endIdx - endEntry.start;
  if (startEntry === endEntry) {
    const v = startEntry.node.nodeValue || '';
    startEntry.node.nodeValue = v.slice(0, startOff) + replacement + v.slice(endOff);
    return;
  }
  const before = (startEntry.node.nodeValue || '').slice(0, startOff);
  const after = (endEntry.node.nodeValue || '').slice(endOff);
  startEntry.node.nodeValue = before + replacement + after;
  let inRange = false;
  for (const e of map) {
    if (e === startEntry) { inRange = true; continue; }
    if (e === endEntry) { e.node.nodeValue = ''; break; }
    if (inRange) e.node.nodeValue = '';
  }
}

/**
 * Masukkan hasil isian AI ke HTML placeholder.
 * Kembalikan { html, filledCount }.
 */
export function applyFillsToTemplate(
  placeholderHtml: string,
  fills: Record<string, string>,
): { html: string; filledCount: number } {
  let filledCount = 0;
  const html = placeholderHtml.replace(/\[\[FILL_(\d+)\]\]/g, (full, num: string) => {
    const raw = fills[num] ?? fills[String(parseInt(num, 10))];
    if (!raw || !String(raw).trim()) return full; // kosongkan? biarkan placeholder bila AI tak mengisi
    filledCount += 1;
    // Escape lalu jadikan baris baru sebagai <br> agar tampil rapi di sel tabel
    return escapeHtml(String(raw).trim()).replace(/\n/g, '<br>');
  });
  return { html, filledCount };
}
