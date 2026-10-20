// Uji numbering + hapus sisa marker
import * as fs from 'fs';
import { JSDOM } from 'jsdom';

async function main() {
  const buf = fs.readFileSync('/tmp/gi/good.docx');
  const blob = new Blob([buf]);
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="c"></div></body></html>', { pretendToBeVisual: true });
  (global as any).window = dom.window; (global as any).document = dom.window.document;
  (global as any).DOMParser = dom.window.DOMParser; (global as any).XMLSerializer = dom.window.XMLSerializer;
  (global as any).Blob = dom.window.Blob; (global as any).URL = dom.window.URL;
  (global as any).Node = dom.window.Node; (global as any).Element = dom.window.Element;
  (global as any).HTMLElement = dom.window.HTMLElement;
  (global as any).getComputedStyle = dom.window.getComputedStyle;
  (global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0);

  const { renderAsync } = await import('/home/hatch/workspace/puskesdoc-fork/node_modules/docx-preview/dist/docx-preview.js');
  const container = document.getElementById('c')!;
  await renderAsync(blob, container, undefined, { inWrapper: false, breakPages: true });
  let html = container.innerHTML;
  html = html.replace(/(<span[^>]*>Pengertian<\/span>)/, '$1 [...]');

  const { syncMarkersToDocx } = await import('/home/hatch/workspace/puskesdoc-fork/src/utils/syncMarkersToDocx');
  const { base64: synced } = await syncMarkersToDocx(html, buf.toString('base64'));

  const { fillDocxOoxml } = await import('/home/hatch/workspace/puskesdoc-fork/src/utils/docxOoxmlFill');
  // Isi dengan list bernomor + satu marker tak terisi (untuk uji hapus sisa)
  const fills = [
    { marker: '[[FILL_0]]', text: '1. Undang-Undang Nomor 17 Tahun 2023\n2. Peraturan Menteri Kesehatan\n3. Keputusan Kepala UPTD' },
  ];
  const outBlob = await fillDocxOoxml(synced, fills as any);
  const outBuf = Buffer.from(await outBlob.arrayBuffer());
  fs.writeFileSync('/tmp/gi/numbered-test.docx', outBuf);

  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(outBuf);
  const xml = await zip.file('word/document.xml')!.async('string');
  const nxml = await zip.file('word/numbering.xml')!.async('string');

  console.log('Teks "Undang-Undang" ada?', xml.includes('Undang-Undang'));
  console.log('Sisa "1." teks?', /<w:t[^>]*>1\. /.test(xml));
  console.log('w:numPr di dokumen?', (xml.match(/<w:numPr>/g) || []).length);
  console.log('numId AI di numbering.xml?', (nxml.match(/<w:num w:numId="1[6-9]"/g) || []).length);
  console.log('Sisa [[FILL_]]?', xml.includes('[[FILL_'));
  console.log('Sisa [...]?', /\[[^\[\]]{1,30}\]/.test(xml.replace(/<[^>]+>/g, '')));
}
main().catch(e => { console.error(e); process.exit(1); });
