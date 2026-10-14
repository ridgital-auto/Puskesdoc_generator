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

  for (const tn of textNodes) {
    const parent = tn.parentElement;
    if (!parent || /^(SCRIPT|STYLE)$/.test(parent.tagName)) continue;
    let text = tn.nodeValue || '';
    let changed = false;

    // 1) Substitusi variabel {{kunci}} yang nilainya sudah ada
    text = text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, key: string) => {
      const v = variables[key];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        changed = true;
        return String(v);
      }
      return full;
    });

    // 2) Tandai [...] menjadi [[FILL_n]]
    text = text.replace(BRACKET_RE, (full, inner: string) => {
      const innerTrim = inner.trim();
      // Abaikan yang terlihat seperti variabel {{}} rusak atau placeholder kita sendiri
      if (!innerTrim || /^\s*FILL_\d+\s*$/.test(innerTrim)) return full;
      counter += 1;
      markers.push({ id: counter, original: innerTrim });
      changed = true;
      return `[[FILL_${counter}]]`;
    });

    if (changed) tn.nodeValue = text;
  }

  if (markers.length === 0) return null;

  const placeholderHtml = root.innerHTML;
  const plainTemplate = htmlToPlainText(placeholderHtml).slice(0, 8000);
  return { placeholderHtml, plainTemplate, markers };
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
