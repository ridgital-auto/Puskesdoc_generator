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
  if (t === 'justify') return AlignmentType.JUSTIFIED;
  return undefined;
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
  const runs: Array<TextRun | ImageRun> = [];
  if (prefix) runs.push(new TextRun({ text: prefix, bold: true }));
  const base = fmtFromElement(el, parentFmt);
  el.childNodes.forEach((ch) => {
    // Tabel di dalam blok → dilewati di sini (ditangani sebagai blok tersendiri)
    if (ch.nodeType === 1 && (ch as HTMLElement).tagName.toLowerCase() === 'table') return;
    inlineToRuns(ch, base, imgMap, runs);
  });
  if (runs.length === 0) return null;
  return new Paragraph({
    children: runs,
    heading: headingLevel(tag),
    alignment: blockAlignment(el),
  });
}

/** Baca fraksi lebar kolom (0..1) dari <colgroup> (dipakai fitur tarik kolom).
 *  Bila tidak ada colgroup, kolom dibagi rata. */
function columnFractions(table: HTMLTableElement, colCount: number): number[] {
  const fracs: number[] = [];
  const cg = table.querySelector('colgroup');
  if (cg) {
    const cols = Array.from(cg.querySelectorAll('col'));
    const widths = cols.map((c) => parseFloat((c as HTMLElement).style.width) || 0);
    const total = widths.reduce((a, b) => a + b, 0);
    if (total > 0) {
      for (let i = 0; i < colCount; i++) fracs.push((widths[i] || total / colCount) / total);
      return fracs;
    }
  }
  for (let i = 0; i < colCount; i++) fracs.push(1 / colCount);
  return fracs;
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
  // Hitung jumlah kolom maksimum (perhitungkan colspan)
  let colCount = 0;
  rowEls.forEach((tr) => {
    let n = 0;
    Array.from(tr.cells).forEach((td) => { n += (td as HTMLTableCellElement).colSpan || 1; });
    colCount = Math.max(colCount, n);
  });
  if (colCount === 0) colCount = 1;
  // Lebar tiap kolom dalam DXA (twips) — proporsional colgroup, pas selebar area konten.
  const fracs = columnFractions(table, colCount);
  const colDxa: number[] = fracs.map((f) => Math.max(1, Math.round(f * widthDxa)));
  // Koreksi pembulatan agar total pas
  const diff = widthDxa - colDxa.reduce((a, b) => a + b, 0);
  colDxa[colDxa.length - 1] = Math.max(1, colDxa[colDxa.length - 1] + diff);

  // Grid okupansi: untuk tiap kolom, berapa baris lagi tertutup oleh rowspan
  // dari sel di baris sebelumnya → diisi sel CONTINUE agar kolom tetap sejajar.
  const rowSpanRemain: number[] = new Array(colCount).fill(0);

  const rows: TableRow[] = rowEls.map((tr) => {
    const cells: TableCell[] = [];
    const tdEls = Array.from(tr.cells) as HTMLTableCellElement[];
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
    columnWidths: colDxa,
    layout: TableLayoutType.FIXED,
    borders: TABLE_BORDERS,
  });
}

/** Konversi anak-anak sebuah elemen menjadi blok docx (paragraf/tabel). */
function convertBlockChildren(parent: Element, out: Array<Paragraph | Table>, imgMap: Map<HTMLImageElement, LoadedImg>, parentFmt: Fmt = {}, tableWidthDxa: number): void {
  Array.from(parent.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = collapseWs(node.nodeValue || '');
      if (t.trim()) out.push(new Paragraph({ children: [new TextRun({ text: t })] }));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === 'table') {
      out.push(convertTable(el as HTMLTableElement, imgMap, tableWidthDxa));
      return;
    }
    if (tag === 'img') {
      const loaded = imgMap.get(el as HTMLImageElement);
      if (loaded) {
        out.push(
          new Paragraph({
            children: [new ImageRun({ type: loaded.type, data: loaded.data, transformation: { width: loaded.width, height: loaded.height } })],
            alignment: blockAlignment(el),
          })
        );
      }
      return;
    }
    if (tag === 'br' || tag === 'hr') {
      out.push(new Paragraph({}));
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      let idx = 0;
      Array.from(el.children).forEach((li) => {
        if (li.tagName.toLowerCase() !== 'li') return;
        idx += 1;
        const p = makeParagraph(li as HTMLElement, 'li', imgMap, tag === 'ul' ? '•  ' : `${idx}. `, parentFmt);
        if (p) out.push(p);
      });
      return;
    }
    // Kontainer (section/article/div/...) SELALU diurai isinya — jangan pernah
    // dijadikan satu paragraf, karena tabel di dalamnya akan terbuang.
    if (CONTAINER_TAGS.test(tag)) {
      convertBlockChildren(el, out, imgMap, { ...parentFmt, ...fmtFromElement(el) }, tableWidthDxa);
      return;
    }
    if (PARA_TAGS.test(tag)) {
      // Paragraf yang mengandung tabel di dalamnya → uraikan sebagai blok
      if (el.querySelector('table')) {
        convertBlockChildren(el, out, imgMap, { ...parentFmt, ...fmtFromElement(el) }, tableWidthDxa);
        return;
      }
      const p = makeParagraph(el, tag, imgMap, '', parentFmt);
      if (p) out.push(p);
      return;
    }
    // Elemen inline di level blok (span, b, a, dsb) → bungkus jadi paragraf
    const runs: Array<TextRun | ImageRun> = [];
    inlineToRuns(el, fmtFromElement(el, parentFmt), imgMap, runs);
    if (runs.length > 0) out.push(new Paragraph({ children: runs, alignment: blockAlignment(el) }));
  });
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
