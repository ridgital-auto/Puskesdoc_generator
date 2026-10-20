/**
 * htmlToDocx.ts — Konversi HTML template Word (hasil isi-template) menjadi
 * berkas .docx ASLI memakai pustaka `docx`.
 *
 * - <table> → tabel Word betulan (termasuk tabel bersarang, colspan/rowspan,
 *   lebar kolom dari <colgroup>, dan warna latar sel).
 * - teks → paragraf dengan format tebal/miring/garis-bawah, ukuran, warna,
 *   dan perataan yang dibaca dari tag & atribut style.
 * - <img> (data URL) → gambar Word.
 * - <ul>/<ol> → paragraf berbutir/bernomor sederhana.
 *
 * Hasilnya dibuka sempurna oleh Microsoft Word — tidak lagi mengandalkan
 * trik Word-HTML yang berantakan di versi Word tertentu.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  ImageRun,
  BorderStyle,
  TableLayoutType,
  VerticalMergeType,
  Header,
  Footer,
  LevelFormat,
} from 'docx';
import type { PuskesDoc } from '../types';
import { getPaperSize, paperSizeToTwips, getMargins, cmToTwips } from './storage';

interface Fmt {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  size?: number; // half-points
  color?: string; // hex tanpa #
}

type ImgType = 'jpg' | 'png' | 'gif' | 'bmp';

interface LoadedImg {
  data: Uint8Array;
  type: ImgType;
  width: number;
  height: number;
}

type DocxAlignment = (typeof AlignmentType)[keyof typeof AlignmentType];
type DocxHeading = (typeof HeadingLevel)[keyof typeof HeadingLevel];

function parseStyleAttr(styleStr: string): Record<string, string> {
  const out: Record<string, string> = {};
  (styleStr || '').split(';').forEach((part) => {
    const idx = part.indexOf(':');
    if (idx > 0) out[part.slice(0, idx).trim().toLowerCase()] = part.slice(idx + 1).trim().toLowerCase();
  });
  return out;
}

function parseColor(v: string | undefined): string | undefined {
  if (!v) return undefined;
  let m = v.match(/#([0-9a-f]{6}|[0-9a-f]{3})/);
  if (m) {
    const h = m[1];
    return h.length === 3 ? h.split('').map((c) => c + c).join('').toUpperCase() : h.toUpperCase();
  }
  m = v.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    const hx = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0').toUpperCase();
    return hx(+m[1]) + hx(+m[2]) + hx(+m[3]);
  }
  return undefined;
}

function parseFontSize(v: string | undefined): number | undefined {
  if (!v) return undefined;
  let m = v.match(/([\d.]+)\s*px/);
  if (m) return Math.max(8, Math.round(parseFloat(m[1]) * 1.5)); // px → half-points
  m = v.match(/([\d.]+)\s*pt/);
  if (m) return Math.max(8, Math.round(parseFloat(m[1]) * 2));
  return undefined;
}

function fmtFromElement(el: HTMLElement, base: Fmt = {}): Fmt {
  const tag = el.tagName.toLowerCase();
  const style = parseStyleAttr(el.getAttribute('style') || '');
  const next: Fmt = { ...base };
  if (tag === 'b' || tag === 'strong' || style['font-weight'] === 'bold' || (parseInt(style['font-weight'] || '0', 10) || 0) >= 700) next.bold = true;
  if (tag === 'i' || tag === 'em' || style['font-style'] === 'italic') next.italic = true;
  if (tag === 'u' || (style['text-decoration'] || '').includes('underline')) next.underline = true;
  const sz = parseFontSize(style['font-size']);
  if (sz) next.size = sz;
  const col = parseColor(style['color']);
  if (col) next.color = col;
  return next;
}

function blockAlignment(el: HTMLElement): DocxAlignment | undefined {
  const style = parseStyleAttr(el.getAttribute('style') || '');
  const t = style['text-align'];
  if (t === 'center') return AlignmentType.CENTER;
  if (t === 'right') return AlignmentType.RIGHT;
  // Default rata kiri: 'justify' dari template diubah jadi kiri agar rapi
  return AlignmentType.LEFT;
}

function collapseWs(s: string): string {
  return s.replace(/[\u00A0\s]+/g, ' ');
}

/** Kumpulkan TextRun/ImageRun dari sebuah subtree inline. */
function inlineToRuns(node: Node, fmt: Fmt, imgMap: Map<HTMLImageElement, LoadedImg>, out: Array<TextRun | ImageRun>): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = collapseWs(node.nodeValue || '');
    if (t.trim() === '' && t === '') return;
    if (t === '') return;
    // Lewati node teks yang murni spasi di antara blok (nanti jadi paragraf kosong)
    if (t.trim() === '') return;
    out.push(
      new TextRun({
        text: t,
        bold: fmt.bold,
        italics: fmt.italic,
        underline: fmt.underline ? {} : undefined,
        size: fmt.size,
        color: fmt.color,
      })
    );
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === 'br') {
    out.push(new TextRun({ break: 1 }));
    return;
  }
  if (tag === 'img') {
    const loaded = imgMap.get(el as HTMLImageElement);
    if (loaded) {
      out.push(
        new ImageRun({
          type: loaded.type,
          data: loaded.data,
          transformation: { width: loaded.width, height: loaded.height },
        })
      );
    }
    return;
  }
  // Jangan telan tabel bersarang di level inline — ditangani di level blok
  if (tag === 'table') return;
  const next = fmtFromElement(el, fmt);
  el.childNodes.forEach((ch) => inlineToRuns(ch, next, imgMap, out));
}

const CONTAINER_TAGS = /^(div|section|article|figure|header|footer)$/;
const PARA_TAGS = /^(p|h1|h2|h3|h4|h5|h6|li|blockquote|pre|figcaption|address)$/;

function headingLevel(tag: string): DocxHeading | undefined {
  switch (tag) {
    case 'h1': return HeadingLevel.HEADING_1;
    case 'h2': return HeadingLevel.HEADING_2;
    case 'h3': return HeadingLevel.HEADING_3;
    case 'h4': return HeadingLevel.HEADING_4;
    case 'h5': return HeadingLevel.HEADING_5;
    case 'h6': return HeadingLevel.HEADING_6;
    default: return undefined;
  }
}

function makeParagraph(el: HTMLElement, tag: string, imgMap: Map<HTMLImageElement, LoadedImg>, prefix = '', parentFmt: Fmt = {}): Paragraph | null {
  // Deteksi list berpenomoran ("1. ", "2. ") → pakai numbering Word asli
  const rawText = (el.textContent || '').trim();
  const numMatch = rawText.match(/^(\d+)\.\s+/);
  const useNumbering = !!numMatch;
  // Strip awalan nomor dari teks agar tidak dobel (Word yang generate nomornya)
  let workEl: HTMLElement = el;
  if (useNumbering) {
    workEl = el.cloneNode(true) as HTMLElement;
    const numStr = numMatch![0];
    // Hapus kemunculan pertama teks nomor dari text node
    const walker = document.createTreeWalker(workEl, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    let remaining = numStr;
    while ((node = walker.nextNode() as Text | null) && remaining) {
      const t = node.nodeValue || '';
      if (t.startsWith(remaining)) {
        node.nodeValue = t.slice(remaining.length);
        remaining = '';
      } else if (remaining.startsWith(t) && t.trim()) {
        remaining = remaining.slice(t.length);
        node.nodeValue = '';
      }
    }
  }
  const runs: Array<TextRun | ImageRun> = [];
  if (prefix) runs.push(new TextRun({ text: prefix, bold: true }));
  const base = fmtFromElement(workEl, parentFmt);
  workEl.childNodes.forEach((ch) => {
    // Tabel di dalam blok → dilewati di sini (ditangani sebagai blok tersendiri)
    if (ch.nodeType === 1 && (ch as HTMLElement).tagName.toLowerCase() === 'table') return;
    inlineToRuns(ch, base, imgMap, runs);
  });
  if (runs.length === 0) return null;
  return new Paragraph({
    children: runs,
    heading: headingLevel(tag),
    alignment: blockAlignment(workEl),
    numbering: useNumbering ? { reference: 'numbered-list', level: 0 } : undefined,
    // Fallback indent bila numbering tak didukung
    indent: useNumbering ? undefined : undefined,
  });
}

/** Baca fraksi lebar kolom (0..1) dari <colgroup> (dipakai fitur tarik kolom).
 *  Bila tidak ada colgroup, kolom dibagi rata. */
function columnFractionsEx(table: HTMLTableElement, colCount: number): { fracs: number[]; hasRealWidths: boolean } {
  const fracs: number[] = [];
  const cg = table.querySelector('colgroup');
  if (cg) {
    const cols = Array.from(cg.querySelectorAll('col'));
    const widths = cols.map((c) => parseCssLength((c as HTMLElement).style.width) || 0);
    const total = widths.reduce((a, b) => a + b, 0);
    if (total > 0) {
      for (let i = 0; i < colCount; i++) fracs.push((widths[i] || total / colCount) / total);
      return { fracs, hasRealWidths: true };
    }
  }
  // Fallback: baca lebar dari sel baris pertama (docx-preview menaruh width inline di td)
  const firstRow = table.rows[0];
  if (firstRow) {
    const cells = Array.from(firstRow.cells) as HTMLTableCellElement[];
    const widths: number[] = [];
    let colIdx = 0;
    for (const td of cells) {
      const w = parseCssLength(td.style.width) || parseFloat(td.getAttribute('width') || '') || 0;
      const span = td.colSpan > 1 ? td.colSpan : 1;
      for (let k = 0; k < span && colIdx < colCount; k++, colIdx++) {
        widths[colIdx] = (w || 0) / span;
      }
    }
    const total = widths.reduce((a, b) => a + b, 0);
    if (total > 0) {
      for (let i = 0; i < colCount; i++) fracs.push((widths[i] || total / colCount) / total);
      return { fracs, hasRealWidths: true };
    }
  }
  for (let i = 0; i < colCount; i++) fracs.push(1 / colCount);
  return { fracs, hasRealWidths: false };
}

function columnFractions(table: HTMLTableElement, colCount: number): number[] {
  return columnFractionsEx(table, colCount).fracs;
}

/** Parse "123px", "50%", "2.5cm" → px (untuk % butuh konteks, kembalikan 0). */
function parseCssLength(s: string): number {
  if (!s) return 0;
  const m = s.trim().match(/^([\d.]+)\s*(px|pt|cm|mm|in|%)?$/i);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  const unit = (m[2] || 'px').toLowerCase();
  if (unit === 'px') return v;
  if (unit === 'pt') return (v * 96) / 72;
  if (unit === 'cm') return (v * 96) / 2.54;
  if (unit === 'mm') return (v * 96) / 25.4;
  if (unit === 'in') return v * 96;
  return 0; // % → tidak bisa tanpa konteks
}

const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  right: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  insideVertical: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
};

function convertTable(table: HTMLTableElement, imgMap: Map<HTMLImageElement, LoadedImg>, widthDxa: number): Table {
  const rowEls = Array.from(table.rows) as HTMLTableRowElement[];
  // Sel yang disembunyikan (display:none) adalah lanjutan vMerge dari docx-preview —
  // jangan hitung sebagai kolom agar grid tidak rusak.
  const isHidden = (td: HTMLTableCellElement) => td.style.display === 'none';
  // Hitung jumlah kolom: utamakan <colgroup>, lalu baris pertama (sel terlihat + colspan).
  let colCount = 0;
  const cg = table.querySelector('colgroup');
  if (cg) colCount = cg.querySelectorAll('col').length;
  if (!colCount && rowEls.length > 0) {
    let n = 0;
    Array.from(rowEls[0].cells).forEach((td) => {
      if (!isHidden(td as HTMLTableCellElement)) n += (td as HTMLTableCellElement).colSpan || 1;
    });
    colCount = n;
  }
  if (colCount === 0) colCount = 1;
  // Deteksi tabel tak beraturan: jumlah sel terlihat bervariasi antar baris
  // (mis. hasil vMerge docx-preview) → pakai AUTOFIT tanpa paksa grid.
  const visibleCounts = rowEls.map((tr) =>
    (Array.from(tr.cells) as HTMLTableCellElement[]).filter((td) => !isHidden(td)).length
  );
  const isIrregular = new Set(visibleCounts).size > 1;
  // Lebar tiap kolom dalam DXA — hanya pakai FIXED bila ada info lebar asli;
  // bila tidak, AUTOFIT agar Word menghitung dari konten (lebih rapi).
  const { fracs, hasRealWidths } = columnFractionsEx(table, colCount);
  const colDxa: number[] = fracs.map((f) => Math.max(1, Math.round(f * widthDxa)));
  // Koreksi pembulatan agar total pas
  const diff = widthDxa - colDxa.reduce((a, b) => a + b, 0);
  colDxa[colDxa.length - 1] = Math.max(1, colDxa[colDxa.length - 1] + diff);

  // Grid okupansi: untuk tiap kolom, berapa baris lagi tertutup oleh rowspan
  // dari sel di baris sebelumnya → diisi sel CONTINUE agar kolom tetap sejajar.
  const rowSpanRemain: number[] = new Array(colCount).fill(0);

  const rows: TableRow[] = rowEls.map((tr, ri) => {
    const cells: TableCell[] = [];
    const allTds = Array.from(tr.cells) as HTMLTableCellElement[];
    const tdEls = allTds.filter((td) => !isHidden(td));
    // Tabel tak beraturan (vMerge): sederhanakan — sel berurutan tanpa merge vertikal.
    // Semua konten tetap ada dan terbaca; lebih baik daripada grid rusak.
    if (isIrregular) {
      for (const td of allTds) {
        const colSpan = td.colSpan > 1 ? td.colSpan : 1;
        const children: Array<Paragraph | Table> = [];
        // Sel hidden (lanjutan vMerge) → sel kosong agar jumlah sel konsisten
        if (!isHidden(td)) {
          convertBlockChildren(td, children, imgMap, fmtFromElement(td), Math.max(1, widthDxa / Math.max(1, allTds.length)));
        }
        if (children.length === 0) children.push(new Paragraph({}));
        const style = parseStyleAttr(td.getAttribute('style') || '');
        const bg = parseColor(style['background-color'] || style['background']);
        cells.push(
          new TableCell({
            children,
            columnSpan: colSpan > 1 ? colSpan : undefined,
            // Tanpa width eksplisit: ikuti gridCols tabel (FIXED) agar Word tidak bingung
            shading: bg ? { fill: bg } : undefined,
          })
        );
      }
      return new TableRow({ children: cells });
    }
    let tdIdx = 0;
    let colIdx = 0;
    while (colIdx < colCount) {
      // Kolom ini masih tertutup merge vertikal dari baris atas
      if (rowSpanRemain[colIdx] > 0) {
        cells.push(
          new TableCell({
            children: [new Paragraph({})],
            verticalMerge: VerticalMergeType.CONTINUE,
            width: { size: colDxa[colIdx], type: WidthType.DXA },
          })
        );
        rowSpanRemain[colIdx]--;
        colIdx++;
        continue;
      }
      const td = tdEls[tdIdx++];
      if (!td) {
        // Baris HTML lebih pendek dari grid → sel kosong
        cells.push(
          new TableCell({
            children: [new Paragraph({})],
            width: { size: colDxa[colIdx], type: WidthType.DXA },
          })
        );
        colIdx++;
        continue;
      }
      const colSpan = td.colSpan > 1 ? td.colSpan : 1;
      const rowSpan = td.rowSpan > 1 ? td.rowSpan : 1;
      let cellDxa = 0;
      for (let k = 0; k < colSpan && colIdx + k < colDxa.length; k++) cellDxa += colDxa[colIdx + k];
      const children: Array<Paragraph | Table> = [];
      // Tabel bersarang: lebarnya selebar sel induknya
      convertBlockChildren(td, children, imgMap, fmtFromElement(td), Math.max(1, cellDxa));
      if (children.length === 0) children.push(new Paragraph({}));
      const style = parseStyleAttr(td.getAttribute('style') || '');
      const bg = parseColor(style['background-color'] || style['background']);
      cells.push(
        new TableCell({
          children,
          columnSpan: colSpan > 1 ? colSpan : undefined,
          rowSpan: rowSpan > 1 ? rowSpan : undefined,
          width: { size: Math.max(1, cellDxa), type: WidthType.DXA },
          shading: bg ? { fill: bg } : undefined,
        })
      );
      if (rowSpan > 1) {
        for (let k = 0; k < colSpan && colIdx + k < colCount; k++) {
          rowSpanRemain[colIdx + k] = rowSpan - 1;
        }
      }
      colIdx += colSpan;
    }
    return new TableRow({ children: cells });
  });

  return new Table({
    rows,
    width: { size: widthDxa, type: WidthType.DXA },
    columnWidths: hasRealWidths ? colDxa : undefined,
    layout: hasRealWidths ? TableLayoutType.FIXED : TableLayoutType.AUTOFIT,
    borders: TABLE_BORDERS,
  });
}

/** Konversi anak-anak sebuah elemen menjadi blok docx (paragraf/tabel). */
/** true bila elemen hanya berisi gambar (tanpa teks berarti) — untuk batching. */
function isImageOnly(el: HTMLElement): boolean {
  const imgs = el.querySelectorAll('img');
  if (imgs.length === 0) return false;
  const text = (el.textContent || '').replace(/\s+/g, '');
  return text.length === 0;
}

/** Kumpulkan semua <img> dalam elemen image-only. */
function collectImgs(el: HTMLElement): HTMLImageElement[] {
  return Array.from(el.querySelectorAll('img')) as HTMLImageElement[];
}

function convertBlockChildren(parent: Element, out: Array<Paragraph | Table>, imgMap: Map<HTMLImageElement, LoadedImg>, parentFmt: Fmt = {}, tableWidthDxa: number): void {
  const nodes = Array.from(parent.childNodes);
  for (let ni = 0; ni < nodes.length; ni++) {
    const node = nodes[ni];
    if (node.nodeType === Node.TEXT_NODE) {
      const t = collapseWs(node.nodeValue || '');
      if (t.trim()) out.push(new Paragraph({ children: [new TextRun({ text: t })] }));
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'table') {
      out.push(convertTable(el as HTMLTableElement, imgMap, tableWidthDxa));
      continue;
    }
    // Elemen kosong sisa pecahan parser (<p></p><span></span> dari <p><span><div><img>)
    // → lewati agar tidak jadi paragraf blank dan tidak memutus batch gambar.
    if ((tag === 'p' || tag === 'div' || tag === 'span') && el.querySelectorAll('img').length === 0 && (el.textContent || '').replace(/\s+/g, '').length === 0) {
      continue;
    }
    if (tag === 'img' || ((tag === 'p' || tag === 'div' || tag === 'span' || tag === 'figure') && isImageOnly(el))) {
      // Batch gambar berurutan jadi SATU paragraf agar tetap sejajar (tidak bertumpuk)
      const imgRuns: ImageRun[] = [];
      let align: any = undefined;
      let j = ni;
      const isEmptyEl = (e: HTMLElement) => {
        const t = e.tagName.toLowerCase();
        if (t !== 'p' && t !== 'div' && t !== 'span') return false;
        return e.querySelectorAll('img').length === 0 && (e.textContent || '').replace(/\s+/g, '').length === 0;
      };
      while (j < nodes.length) {
        const n2 = nodes[j];
        if (n2.nodeType !== Node.ELEMENT_NODE) {
          // teks whitespace di antara gambar → lewati; teks berarti → berhenti
          const tt = n2.nodeType === Node.TEXT_NODE ? (n2.nodeValue || '').replace(/\s+/g, '') : '';
          if (tt) break;
          j++;
          continue;
        }
        const e2 = n2 as HTMLElement;
        const t2 = e2.tagName.toLowerCase();
        // Elemen kosong (parser memecah <p><span><div><img>) → lewati, lanjut cari gambar
        if (isEmptyEl(e2)) { j++; continue; }
        let imgs: HTMLImageElement[] | null = null;
        if (t2 === 'img') imgs = [e2 as HTMLImageElement];
        else if ((t2 === 'p' || t2 === 'div' || t2 === 'span' || t2 === 'figure') && isImageOnly(e2)) imgs = collectImgs(e2);
        else break;
        for (const im of imgs) {
          const loaded = imgMap.get(im);
          if (loaded) {
            imgRuns.push(new ImageRun({ type: loaded.type, data: loaded.data, transformation: { width: loaded.width, height: loaded.height } }));
            if (align === undefined) align = blockAlignment(im);
          }
        }
        j++;
      }
      if (imgRuns.length > 0) {
        // Pisahkan tiap gambar dengan spasi agar tidak menempel
        const children: Array<TextRun | ImageRun> = [];
        imgRuns.forEach((r, idx) => {
          if (idx > 0) children.push(new TextRun({ text: '  ' }));
          children.push(r);
        });
        out.push(new Paragraph({ children, alignment: align }));
      }
      ni = j - 1; // lewati yang sudah diproses
      continue;
    }
    if (tag === 'br' || tag === 'hr') {
      out.push(new Paragraph({}));
      continue;
    }
    if (tag === 'ul' || tag === 'ol') {
      let idx = 0;
      Array.from(el.children).forEach((li) => {
        if (li.tagName.toLowerCase() !== 'li') return;
        idx += 1;
        const p = makeParagraph(li as HTMLElement, 'li', imgMap, tag === 'ul' ? '•  ' : `${idx}. `, parentFmt);
        if (p) out.push(p);
      });
      continue;
    }
    // Kontainer (section/article/div/...) SELALU diurai isinya — jangan pernah
    // dijadikan satu paragraf, karena tabel di dalamnya akan terbuang.
    if (CONTAINER_TAGS.test(tag)) {
      convertBlockChildren(el, out, imgMap, { ...parentFmt, ...fmtFromElement(el) }, tableWidthDxa);
      continue;
    }
    if (PARA_TAGS.test(tag)) {
      // Paragraf yang mengandung tabel di dalamnya → uraikan sebagai blok
      if (el.querySelector('table')) {
        convertBlockChildren(el, out, imgMap, { ...parentFmt, ...fmtFromElement(el) }, tableWidthDxa);
        continue;
      }
      const p = makeParagraph(el, tag, imgMap, '', parentFmt);
      if (p) out.push(p);
      continue;
    }
    // Elemen inline di level blok (span, b, a, dsb) → bungkus jadi paragraf
    const runs: Array<TextRun | ImageRun> = [];
    inlineToRuns(el, fmtFromElement(el, parentFmt), imgMap, runs);
    if (runs.length > 0) out.push(new Paragraph({ children: runs, alignment: blockAlignment(el) }));
  }
}

/** Muat semua <img> (data URL) agar dimensinya diketahui. */
function preloadImages(root: Element): Promise<Map<HTMLImageElement, LoadedImg>> {
  const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
  const map = new Map<HTMLImageElement, LoadedImg>();
  const MAX_W = 500; // px — muat di lebar halaman
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          const src = img.getAttribute('src') || '';
          if (!src.startsWith('data:image')) return resolve();
          const mime = (src.split(';')[0] || '').split('/')[1] || 'png';
          const imgType: ImgType = mime === 'jpeg' || mime === 'jpg' ? 'jpg' : mime === 'gif' ? 'gif' : mime === 'bmp' ? 'bmp' : 'png';
          // Ukuran tampil dari style/atribut (docx-preview menulisnya eksplisit);
          // hanya bila tidak ada, pakai ukuran asli gambar.
          const dispW = parseFloat(img.style.width) || parseFloat(img.getAttribute('width') || '') || 0;
          const dispH = parseFloat(img.style.height) || parseFloat(img.getAttribute('height') || '') || 0;
          const probe = new Image();
          probe.onload = () => {
            try {
              let natW = probe.naturalWidth || 200;
              let natH = probe.naturalHeight || 150;
              if (dispW > 0 && dispH > 0) { natW = dispW; natH = dispH; }
              else if (dispW > 0) { natH = (natH * dispW) / natW; natW = dispW; }
              else if (dispH > 0) { natW = (natW * dispH) / natH; natH = dispH; }
              const scale = Math.min(1, MAX_W / natW);
              // Ambil bytes dari data URL
              const parts = src.split(',');
              const bin = atob(parts[1] || '');
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              map.set(img, {
                data: bytes,
                type: imgType,
                width: Math.round(natW * scale),
                height: Math.round(natH * scale),
              });
            } catch { /* abaikan gambar rusak */ }
            resolve();
          };
          probe.onerror = () => resolve();
          probe.src = src;
        })
    )
  ).then(() => map);
}

function safeFileName(s: string): string {
  return (s || 'dokumen').replace(/[^a-zA-Z0-9\u00C0-\u024F ]/g, '_').trim().substring(0, 40) || 'dokumen';
}

/**
 * Bangun objek Document (docx) dari HTML template. Dipisah dari unduhan
 * agar bisa diuji dan dipakai ulang.
 */
export async function convertHtmlToDocxDocument(doc: PuskesDoc): Promise<Document> {
  const root = document.createElement('div');
  root.innerHTML = doc.originalDocxHtml || '';
  root.querySelectorAll('style, script').forEach((el) => el.remove());

  // Hapus logo bagian akhir: sisakan 2 gambar pertama (logo header),
  // sisanya (logo di bagian akhir dokumen) dibuang agar tidak dobel.
  const allImgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
  if (allImgs.length > 2) {
    for (let i = 2; i < allImgs.length; i++) {
      const img = allImgs[i];
      // Hapus pembungkus kosong yang tersisa (p/div/span hanya berisi img ini)
      let el: HTMLElement | null = img as HTMLElement;
      let parent: HTMLElement | null = null;
      while (el && el !== root) {
        parent = el.parentElement;
        const isWrapper = /^(p|div|span|figure)$/i.test(el.tagName);
        const hasOnlyImg = el.querySelectorAll('img').length <= 1 && (el.textContent || '').replace(/\s+/g, '').length === 0;
        el.remove();
        if (!isWrapper || !hasOnlyImg || !parent || parent === root) break;
        el = parent;
      }
    }
  }

  const imgMap = await preloadImages(root);
  const { width, height } = paperSizeToTwips(getPaperSize());
  const mg = getMargins();
  // Lebar area konten (twips) = lebar kertas − margin kiri/kanan → tabel pas di halaman
  const contentDxa = Math.max(1000, width - cmToTwips(mg.left) - cmToTwips(mg.right));
  const children: Array<Paragraph | Table> = [];

  // docx-preview: 1 <section class="docx"> = 1 halaman Word.
  // - <header>/<footer> di tiap halaman = header/footer Word asli → jadikan header/footer
  //   Word betulan (bukan isi body), ambil dari halaman pertama saja.
  // - Batas antar-halaman dipertahankan (page break) agar pagination mengikuti aslinya:
  //   tidak muat 1 halaman → jadi 2 halaman, sesuai kebutuhan.
  const pageSections = Array.from(root.querySelectorAll('section.docx')) as HTMLElement[];
  let headerPart: Header | undefined;
  let footerPart: Footer | undefined;
  if (pageSections.length > 0) {
    const firstHdr = pageSections[0].querySelector('header');
    if (firstHdr) {
      const hdrChildren: Array<Paragraph | Table> = [];
      convertBlockChildren(firstHdr, hdrChildren, imgMap, {}, contentDxa);
      if (hdrChildren.length > 0) headerPart = new Header({ children: hdrChildren });
    }
    const firstFtr = pageSections[0].querySelector('footer');
    if (firstFtr) {
      const ftrChildren: Array<Paragraph | Table> = [];
      convertBlockChildren(firstFtr, ftrChildren, imgMap, {}, contentDxa);
      if (ftrChildren.length > 0) footerPart = new Footer({ children: ftrChildren });
    }
    // Hapus semua header/footer dari alur body (sudah jadi header/footer Word)
    root.querySelectorAll('header, footer').forEach((el) => el.remove());
    pageSections.forEach((sec, i) => {
      if (i > 0) children.push(new Paragraph({ pageBreakBefore: true }));
      convertBlockChildren(sec, children, imgMap, {}, contentDxa);
    });
  } else {
    convertBlockChildren(root, children, imgMap, {}, contentDxa);
  }
  if (children.length === 0) children.push(new Paragraph({ text: '(Dokumen kosong)' }));
  return new Document({
    numbering: {
      config: [
        {
          reference: 'numbered-list',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 360, hanging: 260 },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        headers: headerPart ? { default: headerPart } : undefined,
        footers: footerPart ? { default: footerPart } : undefined,
        properties: {
          page: {
            size: { width, height },
            margin: {
              top: cmToTwips(mg.top),
              right: cmToTwips(mg.right),
              bottom: cmToTwips(mg.bottom),
              left: cmToTwips(mg.left),
            },
          },
        },
        children,
      },
    ],
  });
}

/**
 * Ekspor dokumen template Word (HTML) menjadi berkas .docx ASLI,
 * lalu unduh. Tampilan di Word mengikuti susunan tabel & format template.
 */
export async function htmlToDocxBlob(doc: PuskesDoc): Promise<Blob> {
  const wordDoc = await convertHtmlToDocxDocument(doc);
  return Packer.toBlob(wordDoc);
}

export async function exportHtmlToDocx(doc: PuskesDoc): Promise<void> {
  const blob = await htmlToDocxBlob(doc);
  const fileName = `${doc.docType || 'Dokumen'}_${safeFileName(doc.title)}.docx`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}
