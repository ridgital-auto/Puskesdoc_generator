// Uji syncMarkersToDocx + fillDocxOoxml
import * as fs from 'fs';
import { JSDOM } from 'jsdom';

async function main() {
  const buf = fs.readFileSync('/tmp/goodinspect/good.docx');
  const blob = new Blob([buf]);
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="c"></div></body></html>', { pretendToBeVisual: true });
  (global as any).window = dom.window;
  (global as any).document = dom.window.document;
  (global as any).DOMParser = dom.window.DOMParser;
  (global as any).XMLSerializer = dom.window.XMLSerializer;
  (global as any).Blob = dom.window.Blob;
  (global as any).URL = dom.window.URL;
  (global as any).Node = dom.window.Node;
  (global as any).Element = dom.window.Element;
  (global as any).HTMLElement = dom.window.HTMLElement;
  (global as any).getComputedStyle = dom.window.getComputedStyle;
  (global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0);

  const { renderAsync } = await import('/home/hatch/workspace/puskesdoc-fork/node_modules/docx-preview/dist/docx-preview.js');
  const container = document.getElementById('c')!;
  await renderAsync(blob, container, undefined, { inWrapper: false, breakPages: true, useBase64URL: true });
  let html = container.innerHTML;

  // Simulasi user: tambahkan [...] di dalam sel (setelah teks "Pengertian")
  html = html.replace(/(<span[^>]*>Pengertian<\/span>)/, '$1 [...]');

  console.log('HTML ada [...]?', html.includes('[...]'));

  const { syncMarkersToDocx, extractMarkersFromHtml } = await import('/home/hatch/workspace/puskesdoc-fork/src/utils/syncMarkersToDocx');
  const markers = extractMarkersFromHtml(html);
  console.log('Marker terdeteksi:', markers.length);
  markers.forEach(mk => console.log(' -', mk.marker, '| ctx:', mk.contextText.slice(0, 50)));

  const base64 = buf.toString('base64');
  const { base64: synced, count } = await syncMarkersToDocx(html, base64);
  console.log('Marker tersisip ke .docx:', count);

  // Verifikasi: buka .docx hasil sync, cek [[FILL_]] ada
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(synced, { base64: true });
  const xml = await zip.file('word/document.xml')!.async('string');
  console.log('[[FILL_0]] di XML?', xml.includes('[[FILL_0]]'));

  // Sekarang fill via OOXML
  const { fillDocxOoxml } = await import('/home/hatch/workspace/puskesdoc-fork/src/utils/docxOoxmlFill');
  const fills = [{ marker: '[[FILL_0]]', text: 'INI HASIL AI UNTUK PENGERTIAN' }];
  const filledBlob = await fillDocxOoxml(synced, fills as any);
  const filledBuf = Buffer.from(await filledBlob.arrayBuffer());
  fs.writeFileSync('/tmp/goodinspect/filled-test.docx', filledBuf);
  console.log('filled-test.docx:', filledBuf.length);

  // Verifikasi isi
  const zip2 = await JSZip.loadAsync(filledBuf);
  const xml2 = await zip2.file('word/document.xml')!.async('string');
  console.log('Teks AI ada?', xml2.includes('INI HASIL AI'));
  console.log('Marker sisa?', xml2.includes('[[FILL_'));
  // Struktur tabel tetap?
  const vMerge = (x: string) => (x.match(/w:vMerge/g) || []).length;
  console.log('vMerge asli vs hasil:', vMerge(await (await JSZip.loadAsync(buf)).file('word/document.xml')!.async('string')), 'vs', vMerge(xml2));
}
main().catch(e => { console.error(e); process.exit(1); });
