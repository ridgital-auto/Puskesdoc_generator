import * as mammoth from 'mammoth';
import JSZip from 'jszip';
import { renderAsync } from 'docx-preview';

export interface DocxExtractionResult {
  html: string;
  rawText: string;
  base64?: string;
  embeddedImages?: { name: string; dataUrl: string }[];
}

export async function extractTextFromDocx(file: File): Promise<string> {
  const res = await extractDocxAsHtml(file);
  return res.rawText;
}

/**
 * Extracts all embedded images (logos, signatures, charts) directly from word/media/* inside DOCX
 */
export async function extractImagesFromDocxZip(arrayBuffer: ArrayBuffer): Promise<{ name: string; dataUrl: string }[]> {
  const images: { name: string; dataUrl: string }[] = [];
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const mediaFiles = Object.keys(zip.files).filter((fileName) => /^word\/media\//i.test(fileName));
    for (const fileName of mediaFiles) {
      const file = zip.files[fileName];
      if (!file || file.dir) continue;
      const base64Data = await file.async('base64');
      const ext = fileName.split('.').pop()?.toLowerCase() || 'png';
      let mime = 'image/png';
      if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
      else if (ext === 'gif') mime = 'image/gif';
      else if (ext === 'svg') mime = 'image/svg+xml';
      else if (ext === 'webp') mime = 'image/webp';

      const cleanName = fileName.replace(/^word\/media\//i, '');
      images.push({
        name: cleanName,
        dataUrl: `data:${mime};base64,${base64Data}`,
      });
    }
  } catch (err) {
    console.warn('Gagal membaca gambar dari zip docx:', err);
  }
  return images;
}

/**
 * Converts ArrayBuffer to Base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts Base64 to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const base64Clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(base64Clean);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * High-fidelity Word (.docx) renderer that renders the document matching exact Word layout
 * into a target HTML element without extracting or stripping formatting.
 */
export async function renderDocxToContainer(
  data: ArrayBuffer | Blob | string,
  container: HTMLElement
): Promise<void> {
  let source: ArrayBuffer | Blob;
  if (typeof data === 'string') {
    source = base64ToArrayBuffer(data);
  } else {
    source = data;
  }

  container.innerHTML = '';
  await renderAsync(source, container, undefined, {
    inWrapper: false,
    ignoreWidth: false,
    ignoreHeight: false,
    breakPages: true,
    renderHeaders: true,
    renderFooters: true,
    useBase64URL: false, // base64 bug di library; suntik manual di bawah
  });
  // Suntik src gambar asli (urut dokumen)
  try {
    const buf = source instanceof Blob ? await source.arrayBuffer() : source;
    injectImageSrcs(container, await getImageDataUrls(buf));
  } catch (err) {
    console.warn('Gagal suntik gambar preview:', err);
  }
}

/**
 * Ekstrak gambar dalam URUTAN DOKUMEN (sesuai kemunculan <a:blip r:embed>
 * di document.xml + header*.xml), agar bisa dipasangkan ke <img> hasil
 * render docx-preview yang src-nya kosong (bug useBase64URL di library).
 */
export async function extractImagesInDocOrder(arrayBuffer: ArrayBuffer): Promise<string[]> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    // Peta nama file -> dataUrl
    const dataByPath = new Map<string, string>();
    const mediaFiles = Object.keys(zip.files).filter((f) => /^word\/media\//i.test(f) && !zip.files[f].dir);
    for (const fn of mediaFiles) {
      const b64 = await zip.files[fn].async('base64');
      const ext = fn.split('.').pop()?.toLowerCase() || 'png';
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : 'image/png';
      dataByPath.set(fn.replace(/^word\//, ''), `data:${mime};base64,${b64}`);
    }
    // Urutan: document.xml dulu, lalu header/footer
    const ordered: string[] = [];
    const partNames = Object.keys(zip.files).filter((f) => /^word\/(document|header\d+|footer\d+)\.xml$/i.test(f));
    partNames.sort((a, b) => (a.includes('document') ? -1 : b.includes('document') ? 1 : a.localeCompare(b)));
    for (const part of partNames) {
      const xml = await zip.files[part].async('string');
      const relsName = part.replace('word/', 'word/_rels/') + '.rels';
      const relsFile = zip.files[relsName];
      if (!relsFile) continue;
      const relsXml = await relsFile.async('string');
      const relMap = new Map<string, string>();
      for (const m of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
        relMap.set(m[1], m[2].replace(/^\.\.\//, '').replace(/^\//, ''));
      }
      for (const m of xml.matchAll(/r:embed="([^"]+)"/g)) {
        const target = relMap.get(m[1]);
        if (target) {
          const url = dataByPath.get(target) || dataByPath.get('media/' + target.split('/').pop());
          if (url) ordered.push(url);
        }
      }
    }
    return ordered;
  } catch (err) {
    console.warn('Gagal ekstrak gambar urut dokumen:', err);
    return [];
  }
}

/** Ambil dataUrl gambar: utamakan urutan dokumen; fallback ke semua media. */
export async function getImageDataUrls(arrayBuffer: ArrayBuffer): Promise<string[]> {
  const ordered = await extractImagesInDocOrder(arrayBuffer);
  if (ordered.length > 0) return ordered;
  const all = await extractImagesFromDocxZip(arrayBuffer);
  return all.map((i) => i.dataUrl);
}

/** Pasangkan src base64 ke <img> hasil render yang src-nya kosong/blob. */
export function injectImageSrcs(container: HTMLElement, orderedDataUrls: string[]): void {
  const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
  imgs.forEach((img, i) => {
    const src = img.getAttribute('src') || '';
    // src kosong atau blob sementara → ganti dengan data URL permanen
    if ((!src || src.startsWith('blob:')) && orderedDataUrls[i]) {
      img.setAttribute('src', orderedDataUrls[i]);
    }
  });
}

/**
 * Extracts Word (.docx) document preserving original styling, tables, bold, alignments and images.
 * Also stores the binary base64 so it can be re-rendered in authentic Word layout.
 */
export async function extractDocxAsHtml(file: File): Promise<DocxExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);
  const embeddedImages = await extractImagesFromDocxZip(arrayBuffer);

  // Try rendering via docx-preview in an offscreen container to extract authentic HTML if possible
  try {
    const offscreen = document.createElement('div');
    await renderAsync(arrayBuffer, offscreen, undefined, {
      inWrapper: false,
      ignoreWidth: false,
      ignoreHeight: false,
      breakPages: true,
      renderHeaders: true,
      renderFooters: true,
      useBase64URL: false, // base64 bug di library; suntik manual di bawah
    });
    // Suntik src gambar asli (urut dokumen) karena <img> tanpa src dari renderer
    injectImageSrcs(offscreen, await getImageDataUrls(arrayBuffer));

    const renderedHtml = offscreen.innerHTML;
    if (renderedHtml && renderedHtml.trim().length > 30) {
      // docx-preview menyisipkan <style> berisi kode CSS (.docx-*) di dalam container.
      // Singkirkan dulu agar CSS tidak ikut terbaca sebagai "teks dokumen".
      const clean = offscreen.cloneNode(true) as HTMLElement;
      clean.querySelectorAll('style, script').forEach((el) => el.remove());
      return {
        html: renderedHtml,
        rawText: clean.textContent || '',
        base64,
        embeddedImages,
      };
    }
  } catch (renderErr) {
    console.warn('docx-preview offscreen extract fallback:', renderErr);
  }

  try {
    // Attempt conversion using mammoth with image support
    const result = await (mammoth as any).convertToHtml(
      { arrayBuffer },
      {
        convertImage: (mammoth as any).images.imgElement((image: any) => {
          return image.read('base64').then((imageBuffer: string) => {
            return {
              src: `data:${image.contentType};base64,${imageBuffer}`,
            };
          });
        }),
      }
    );

    const html = result.value || '';
    if (html.trim().length > 0) {
      return {
        html,
        rawText: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
        base64,
        embeddedImages,
      };
    }
  } catch (mammothErr) {
    console.warn('Mammoth conversion fallback to XML parser:', mammothErr);
  }

  // XML Fallback parser
  const fallback = await extractDocxXmlFallback(arrayBuffer, embeddedImages);
  return {
    ...fallback,
    base64,
    embeddedImages,
  };
}

// Fallback: Parses word/document.xml with full table, row, cell, and paragraph layout
async function extractDocxXmlFallback(
  arrayBuffer: ArrayBuffer,
  embeddedImages?: { name: string; dataUrl: string }[]
): Promise<{ html: string; rawText: string }> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const documentXmlFile = zip.file('word/document.xml');
  if (!documentXmlFile) {
    throw new Error('Berkas tidak valid atau tidak berisi word/document.xml');
  }

  const xmlText = await documentXmlFile.async('text');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

  const body = xmlDoc.getElementsByTagName('w:body')[0];
  if (!body) {
    return { html: '<p>Dokumen kosong</p>', rawText: '' };
  }

  function getNodeText(node: Node): string {
    let text = '';
    const textNodes = (node as Element).getElementsByTagName('w:t');
    for (let i = 0; i < textNodes.length; i++) {
      text += textNodes[i].textContent || '';
    }
    return text;
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  let htmlResult = '';
  let textResult = '';

  // Render any extracted embedded images (e.g. logos/stamps) at top if found
  if (embeddedImages && embeddedImages.length > 0) {
    htmlResult += '<div style="display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">';
    embeddedImages.forEach((img) => {
      htmlResult += `<img src="${img.dataUrl}" alt="${escapeHtml(img.name)}" style="max-height: 80px; object-fit: contain;" />`;
    });
    htmlResult += '</div>';
  }

  for (let i = 0; i < body.childNodes.length; i++) {
    const node = body.childNodes[i];
    const nodeName = node.nodeName;

    // Paragraph
    if (nodeName === 'w:p') {
      const elem = node as Element;
      const pText = getNodeText(node);
      const isHeading = elem.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val')?.toLowerCase().includes('heading');
      const isBold = elem.getElementsByTagName('w:b').length > 0;
      const isCenter = elem.getElementsByTagName('w:jc')[0]?.getAttribute('w:val') === 'center';
      const isRight = elem.getElementsByTagName('w:jc')[0]?.getAttribute('w:val') === 'right';

      if (pText.trim().length > 0) {
        textResult += pText + '\n';
        const alignStyle = isCenter ? 'text-align: center;' : isRight ? 'text-align: right;' : '';
        const weightStyle = isBold ? 'font-weight: bold;' : '';
        const tag = isHeading ? 'h3' : 'p';
        htmlResult += `<${tag} style="${alignStyle} ${weightStyle} margin-bottom: 0.5rem;">${escapeHtml(pText)}</${tag}>`;
      } else {
        htmlResult += '<br/>';
      }
    }
    // Table
    else if (nodeName === 'w:tbl') {
      htmlResult += '<table style="width: 100%; border-collapse: collapse; margin: 1rem 0; border: 1.5px solid #000;">';
      const rows = (node as Element).getElementsByTagName('w:tr');
      for (let r = 0; r < rows.length; r++) {
        htmlResult += '<tr>';
        const cells = rows[r].getElementsByTagName('w:tc');
        for (let c = 0; c < cells.length; c++) {
          const cellText = getNodeText(cells[c]);
          textResult += cellText + '\t';
          htmlResult += `<td style="border: 1px solid #000; padding: 6px 8px; vertical-align: top;">${escapeHtml(cellText) || '&nbsp;'}</td>`;
        }
        htmlResult += '</tr>';
        textResult += '\n';
      }
      htmlResult += '</table>';
    }
  }

  return {
    html: htmlResult || '<p>Tidak ada teks naskah ditemukan</p>',
    rawText: textResult.trim(),
  };
}
