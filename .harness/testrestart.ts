// Uji: AI menomori LANJUT antar sel (Referensi 1-2, lalu Alat 3-4)
// Harus restart: Referensi 1,2 dan Alat 1,2 (bukan 3,4)
import * as fs from 'fs';
import { JSDOM } from 'jsdom';

async function main() {
  const buf = fs.readFileSync('/tmp/gi/good.docx');
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="c"></div></body></html>', { pretendToBeVisual: true });
  (global as any).window = dom.window; (global as any).document = dom.window.document;
  (global as any).DOMParser = dom.window.DOMParser; (global as any).XMLSerializer = dom.window.XMLSerializer;
  (global as any).Blob = dom.window.Blob; (global as any).URL = dom.window.URL;
  (global as any).Node = dom.window.Node; (global as any).Element = dom.window.Element;
  (global as any).HTMLElement = dom.window.HTMLElement;
  (global as any).getComputedStyle = dom.window.getComputedStyle;
  (global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
  let n = 0; (global as any).URL.createObjectURL = () => 'blob:' + (++n); (global as any).URL.revokeObjectURL = () => {};
  (global as any).FileReader = class { readAsDataURL(){ } };

  const { renderAsync } = await import('/home/hatch/workspace/puskesdoc-fork/node_modules/docx-preview/dist/docx-preview.js');
  const container = document.getElementById('c')!;
  await renderAsync(buf, container, undefined, { inWrapper: false, breakPages: true, useBase64URL: false });
  let html = container.innerHTML;
  // Tambahkan [...] di 2 sel: Pengertian & Tujuan
  html = html.replace(/(<span[^>]*>Pengertian<\/span>)/, '$1 [...]');
  html = html.replace(/(<span[^>]*>Tujuan<\/span>)/, '$1 [...]');

  const { syncMarkersToDocx } = await import('/home/hatch/workspace/puskesdoc-fork/src/utils/syncMarkersToDocx');
  const { base64: synced, count } = await syncMarkersToDocx(html, buf.toString('base64'));
  console.log('Marker tersisip:', count);

  const { fillDocxOoxml } = await import('/home/hatch/workspace/puskesdoc-fork/src/utils/docxOoxmlFill');
  // AI isi: FILL_0 = list 1-2, FILL_1 = list LANJUT 3-4 (simulasi perilaku AI)
  const fills = [
    { marker: '[[FILL_0]]', text: '1. Undang-Undang Kesehatan\n2. Peraturan Menteri' },
    { marker: '[[FILL_1]]', text: '3. Komputer dan Printer\n4. Alat Tulis Kantor' },
  ];
  const out = await fillDocxOoxml(synced, fills as any);
  const outBuf = Buffer.from(await out.arrayBuffer());
  fs.writeFileSync('/tmp/gi/restart-test.docx', outBuf);

  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(outBuf);
  const xml = await zip.file('word/document.xml')!.async('string');
  // Ambil numId untuk tiap item
  const items = ['Undang-Undang Kesehatan', 'Peraturan Menteri', 'Komputer dan Printer', 'Alat Tulis Kantor'];
  for (const it of items) {
    const idx = xml.indexOf(it);
    // Cari numId terdekat SEBELUM teks (dalam paragraf yang sama)
    const before = xml.slice(Math.max(0, idx - 1500), idx);
    const m = [...before.matchAll(/<w:numId w:val="(\d+)"\/>/g)].pop();
    console.log(it, '-> numId:', m ? m[1] : '(tidak ada)');
  }
  // Cek teks angka sudah dibuang
  console.log('Sisa teks "3. Komputer"?', xml.includes('3. Komputer'));
  console.log('Sisa teks "4. Alat"?', xml.includes('4. Alat'));
}
main().catch(e => { console.error(e); process.exit(1); });
