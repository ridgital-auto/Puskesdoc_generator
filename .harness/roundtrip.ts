// Harness round-trip: .docx -> docx-preview HTML -> converter -> .docx
// Uji apakah header tabel rusak dalam konversi.
import * as fs from 'fs';
import { JSDOM } from 'jsdom';

async function main() {
  const mode = process.argv[2] || 'good'; // 'good' atau file lain
  const srcPath = mode === 'good'
    ? '/tmp/goodinspect/good.docx'
    : '/tmp/goodinspect/good.docx';

  // 1. Render .docx -> HTML via docx-preview
  const buf = fs.readFileSync(srcPath);
  const blob = new Blob([buf]);
  const dom1 = new JSDOM('<!DOCTYPE html><html><body><div id="c"></div></body></html>', { pretendToBeVisual: true });
  (global as any).window = dom1.window;
  (global as any).document = dom1.window.document;
  (global as any).DOMParser = dom1.window.DOMParser;
  (global as any).XMLSerializer = dom1.window.XMLSerializer;
  (global as any).Blob = dom1.window.Blob;
  (global as any).URL = dom1.window.URL;
  (global as any).Node = dom1.window.Node;
  (global as any).Element = dom1.window.Element;
  (global as any).HTMLElement = dom1.window.HTMLElement;
  (global as any).getComputedStyle = dom1.window.getComputedStyle;
  (global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0);

  const { renderAsync } = await import('/home/hatch/workspace/puskesdoc-fork/node_modules/docx-preview/dist/docx-preview.js');
  const container = document.getElementById('c')!;
  await renderAsync(blob, container, undefined, {
    inWrapper: false, breakPages: true, useBase64URL: true,
  });
  const html = container.innerHTML;
  console.log('HTML length:', html.length);

  // 2. Suntik src gambar dari media asli (jsdom tak buat object URL)
  // (skip - gambar tidak kritis untuk uji header)

  // 3. HTML -> .docx via converter
  const store: Record<string, string> = {};
  (global as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => {},
  };
  (global as any).Image = class {
    onload: any = null; naturalWidth = 200; naturalHeight = 150;
    set src(s: string) { setTimeout(() => this.onload && this.onload(), 0); }
  };
  (global as any).atob = (s: string) => Buffer.from(s, 'base64').toString('binary');

  const { convertHtmlToDocxDocument } = await import('/home/hatch/workspace/puskesdoc-fork/src/utils/htmlToDocx');
  const { Packer } = await import('docx');
  const fakeDoc = { originalDocxHtml: html, title: 'Test', docType: 'PEDOMAN' } as any;
  const wordDoc = await convertHtmlToDocxDocument(fakeDoc);
  const outBuf = await Packer.toBuffer(wordDoc);
  fs.writeFileSync('/tmp/goodinspect/roundtrip.docx', outBuf);
  console.log('roundtrip.docx written:', outBuf.length);

  // 4. Analisis: bandingkan struktur tabel header asli vs hasil
  const { default: JSZip } = await import('jszip');
  const zipOrig = await JSZip.loadAsync(buf);
  const xmlOrig = await zipOrig.file('word/document.xml')!.async('string');
  const zipOut = await JSZip.loadAsync(outBuf);
  const xmlOut = await zipOut.file('word/document.xml')!.async('string');

  const getTables = (xml: string) => {
    const tables: string[] = [];
    let depth = 0, start = -1;
    const re = /<\/?w:tbl>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
      if (m[0] === '<w:tbl>') { if (depth === 0) start = m.index; depth++; }
      else { depth--; if (depth === 0) tables.push(xml.slice(start, m.index + m[0].length)); }
    }
    return tables;
  };
  const tOrig = getTables(xmlOrig)[0];
  const tOut = getTables(xmlOut)[0];
  const grid = (t: string) => [...t.matchAll(/<w:gridCol w:w="(\d+)"/g)].map(x => x[1]);
  console.log('ORIG grid:', grid(tOrig).join(','));
  console.log('OUT  grid:', grid(tOut).join(','));
  const rows = (t: string) => [...t.matchAll(/<w:tr>.*?<\/w:tr>/gs)].length;
  console.log('ORIG rows:', rows(tOrig), '| OUT rows:', rows(tOut));
}
main().catch(e => { console.error(e); process.exit(1); });
