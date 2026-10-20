// syncMarkersToDocx: sisipkan penanda [...] dari HTML ke .docx asli (base64).
// Tujuannya: .docx tetap 100% asli kecuali di titik [...] saja,
// sehingga fill via OOXML tidak merubah bagian lain.
import JSZip from 'jszip';

interface MarkerLoc {
  marker: string; // "[[FILL_0]]"
  contextText: string; // teks sel/paragraf induk (tanpa marker)
}

export function extractMarkersFromHtml(html: string): MarkerLoc[] {
  const markers: MarkerLoc[] = [];
  // Cari semua [...] dalam urutan dokumen, hindari hitung ganda.
  // Untuk tiap [...], ambil konteks = teks sel <td>/<th> terdekat (atau <p>).
  const markerRe = /\[([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  const seen = new Set<number>(); // posisi yang sudah diproses
  while ((m = markerRe.exec(html))) {
    if (seen.has(m.index)) continue;
    seen.add(m.index);
    // Cari <td> atau <p> yang mengandung posisi ini (mundur dari m.index)
    const before = html.slice(0, m.index);
    const tdStart = Math.max(before.lastIndexOf('<td'), before.lastIndexOf('<th'));
    const pStart = before.lastIndexOf('<p');
    let ctx = '';
    if (tdStart > pStart && tdStart >= 0) {
      // Ambil isi td dari tdStart sampai </td> setelah marker
      const tdEnd = html.indexOf('</td>', m.index);
      const thEnd = html.indexOf('</th>', m.index);
      const end = tdEnd >= 0 ? tdEnd : thEnd;
      if (end > 0) {
        const cellHtml = html.slice(tdStart, end);
        ctx = cellHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/\[[^\]]*\]/g, '').trim();
      }
    } else if (pStart >= 0) {
      const pEnd = html.indexOf('</p>', m.index);
      if (pEnd > 0) {
        const pHtml = html.slice(pStart, pEnd);
        ctx = pHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/\[[^\]]*\]/g, '').trim();
      }
    }
    markers.push({ marker: `[[FILL_${idx++}]]`, contextText: ctx.slice(0, 80) });
  }
  return markers;
}

export async function syncMarkersToDocx(html: string, base64: string): Promise<{ base64: string; count: number }> {
  const markers = extractMarkersFromHtml(html);
  if (markers.length === 0) return { base64, count: 0 };

  const zip = await JSZip.loadAsync(base64, { base64: true });
  const docFile = zip.file('word/document.xml');
  if (!docFile) throw new Error('word/document.xml tidak ditemukan');
  let xml = await docFile.async('string');

  // Untuk tiap marker, cari paragraf <w:p> yang teksnya mirip contextText,
  // lalu sisipkan marker di akhir paragraf itu.
  // Pendekatan: ekstrak semua <w:p>...</w:p> beserta teksnya.
  const pRe = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  const paras: { xml: string; text: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pRe.exec(xml))) {
    const pXml = m[0];
    const text = pXml.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    paras.push({ xml: pXml, text, start: m.index, end: m.index + pXml.length });
  }

  // Sisipkan dari belakang agar indeks tidak bergeser
  const insertions: { pos: number; markerXml: string }[] = [];
  const used = new Set<number>();
  for (const mk of markers) {
    // Cari paragraf dengan kecocokan teks terbaik (belum dipakai)
    let best = -1, bestScore = 0;
    for (let i = 0; i < paras.length; i++) {
      if (used.has(i)) continue;
      const pt = paras[i].text;
      if (!pt || pt.length < 3) continue;
      // Skor: berapa kata dari context yang ada di paragraf
      const ctxWords = mk.contextText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      if (ctxWords.length === 0) continue;
      const ptLow = pt.toLowerCase();
      let hit = 0;
      for (const w of ctxWords) if (ptLow.includes(w)) hit++;
      const score = hit / ctxWords.length;
      if (score > bestScore && score >= 0.5) { bestScore = score; best = i; }
    }
    if (best >= 0) {
      used.add(best);
      // Sisipkan marker sebelum </w:p>
      const pXml = paras[best].xml;
      const insertPos = paras[best].end - '</w:p>'.length;
      const markerXml = `<w:r><w:t xml:space="preserve"> ${mk.marker}</w:t></w:r>`;
      insertions.push({ pos: insertPos, markerXml });
    }
  }

  insertions.sort((a, b) => b.pos - a.pos);
  for (const ins of insertions) {
    xml = xml.slice(0, ins.pos) + ins.markerXml + xml.slice(ins.pos);
  }

  zip.file('word/document.xml', xml);
  const outBase64 = await zip.generateAsync({ type: 'base64' });
  return { base64: outBase64, count: insertions.length };
}
