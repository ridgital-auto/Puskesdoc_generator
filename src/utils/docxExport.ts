import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
} from 'docx';
import { PuskesDoc, FaskesProfile } from '../types';
import { getPaperSize, paperSizeToTwips } from './storage';

/** Properti halaman Word sesuai pilihan ukuran kertas pengguna. */
function getPageProperties() {
  const { width, height } = paperSizeToTwips(getPaperSize());
  return {
    page: {
      size: { width, height },
      margin: {
        top: 1440, // 1 inch
        right: 1440,
        bottom: 1440,
        left: 1440,
      },
    },
  };
}

/** Unduh dokumen template Word (HTML) sebagai berkas .doc yang dibuka native oleh MS Word. */
export function downloadWordHtmlDoc(doc: PuskesDoc): void {
  const safeTitle = (doc.title || 'dokumen').replace(/[^a-zA-Z0-9\u00C0-\u024F ]/g, '_').trim().substring(0, 40) || 'dokumen';
  const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>body{font-family:Calibri,Arial,sans-serif;}</style>
<title>${safeTitle}</title>
</head>
<body>${doc.originalDocxHtml || ''}</body>
</html>`;
  const blob = new Blob(['\ufeff', wordHtml], { type: 'application/msword' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${doc.docType || 'Dokumen'}_${safeTitle}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

export async function exportToDocx(doc: PuskesDoc, profile: FaskesProfile): Promise<void> {
  // Dokumen berbasis template Word asli (.docx): unduh sebagai Word-HTML (.doc)
  // agar TAMPIL PERSIS seperti lembar kerja (tabel, kop, format utuh).
  // Microsoft Word membuka berkas .doc berisi HTML ini secara native.
  if (doc.originalDocxHtml && doc.originalDocxHtml.trim()) {
    downloadWordHtmlDoc(doc);
    return;
  }

  const sections: any[] = [];

  // 1. KOP SURAT (if useKop is true)
  if (doc.useKop) {
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: profile.pemerintahDaerah.toUpperCase(),
            font: 'Arial',
            size: 24, // 12pt
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: profile.dinasKesehatan.toUpperCase(),
            font: 'Arial',
            size: 26, // 13pt
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: profile.namaPuskesmas.toUpperCase(),
            font: 'Arial',
            size: 30, // 15pt
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: `${profile.alamat} Telp: ${profile.telepon} Email: ${profile.email}`,
            font: 'Arial',
            size: 18, // 9pt
            italics: true,
          }),
        ],
      }),
      // Divider line
      new Paragraph({
        border: {
          bottom: {
            color: '000000',
            space: 1,
            style: BorderStyle.DOUBLE,
            size: 12,
          },
        },
        spacing: { after: 200 },
      })
    );
  }

  // 2. DOCUMENT SPECIFIC HEADER
  if (doc.docType === 'SOP') {
    // Official Kemenkes SOP Header Table
    const sopTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 100, after: 100 },
                  children: [
                    new TextRun({
                      text: doc.title.toUpperCase(),
                      font: 'Arial',
                      bold: true,
                      size: 24,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `No. Dokumen : ${doc.sopMetadata?.noDokumen || doc.docNumber || '-'}`, font: 'Arial', size: 18 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: `No. Revisi   : ${doc.sopMetadata?.noRevisi || '00'}`, font: 'Arial', size: 18 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: `SOP`, font: 'Arial', bold: true, size: 20 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: `Tanggal Terbit : ${doc.sopMetadata?.tanggalTerbit || new Date().toLocaleDateString('id-ID')}`, font: 'Arial', size: 18 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: `Halaman      : ${doc.sopMetadata?.halaman || '1/2'}`, font: 'Arial', size: 18 }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 80, after: 80 },
                  children: [
                    new TextRun({ text: profile.namaPuskesmas.toUpperCase(), font: 'Arial', bold: true, size: 20 }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `Ditetapkan Oleh : ${profile.jabatanKepala}`, font: 'Arial', bold: true, size: 18 }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 200 },
                  children: [
                    new TextRun({ text: profile.kepalaPuskesmas, font: 'Arial', bold: true, underline: {}, size: 20 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: `NIP. ${profile.nipKepala}`, font: 'Arial', size: 18 }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    sections.push(sopTable);
    sections.push(new Paragraph({ spacing: { after: 200 } }));
  } else if (doc.docType === 'SK') {
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({ text: `KEPUTUSAN KEPALA ${profile.namaPuskesmas.toUpperCase()}`, font: 'Arial', bold: true, size: 24 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({ text: `NOMOR : ${doc.docNumber || '440/001/SK/PKM/2026'}`, font: 'Arial', bold: true, size: 22 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 140 },
        children: [
          new TextRun({ text: `TENTANG`, font: 'Arial', bold: true, size: 22 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({ text: doc.title.toUpperCase(), font: 'Arial', bold: true, size: 24 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({ text: `DENGAN RAHMAT TUHAN YANG MAHA ESA\nKEPALA ${profile.namaPuskesmas.toUpperCase()},`, font: 'Arial', bold: true, size: 22 }),
        ],
      })
    );
  } else {
    // KAK, Pedoman, Panduan, Custom
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({ text: doc.docType === 'KAK' ? 'KERANGKA ACUAN KERJA (KAK)' : doc.title.toUpperCase(), font: 'Arial', bold: true, size: 26 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [
          new TextRun({ text: doc.title.toUpperCase(), font: 'Arial', bold: true, size: 22 }),
        ],
      })
    );
  }

  // 3. BODY SECTIONS
  doc.sections.forEach((sec, idx) => {
    sections.push(
      new Paragraph({
        spacing: { before: 140, after: 60 },
        children: [
          new TextRun({
            text: sec.title.match(/^\d+|^[A-Z]\./) ? sec.title : `${idx + 1}. ${sec.title}`,
            font: 'Arial',
            bold: true,
            size: 22,
          }),
        ],
      })
    );

    const paragraphs = sec.content.split('\n');
    paragraphs.forEach((p) => {
      if (p.trim().length > 0) {
        sections.push(
          new Paragraph({
            spacing: { after: 60 },
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({
                text: p,
                font: 'Arial',
                size: 22,
              }),
            ],
          })
        );
      }
    });
  });

  // 4. SIGNATURE FOOTER (for SK, KAK, etc.)
  if (doc.docType !== 'SOP') {
    sections.push(
      new Paragraph({ spacing: { before: 300 } }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({})] }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: `Ditetapkan di : ${profile.kabupatenKota}`, font: 'Arial', size: 20 }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: `Pada tanggal  : ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, font: 'Arial', size: 20 }),
                    ],
                  }),
                  new Paragraph({
                    spacing: { before: 60, after: 200 },
                    children: [
                      new TextRun({ text: `${profile.jabatanKepala.toUpperCase()},`, font: 'Arial', bold: true, size: 20 }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: profile.kepalaPuskesmas, font: 'Arial', bold: true, underline: {}, size: 20 }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: `NIP. ${profile.nipKepala}`, font: 'Arial', size: 18 }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  // Create Document
  const wordDoc = new Document({
    sections: [
      {
        properties: getPageProperties(),
        children: sections,
      },
    ],
  });

  const blob = await Packer.toBlob(wordDoc);
  const fileName = `${doc.docType}_${doc.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40)}.docx`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Generate Docx Blob & FileName directly
export async function generateDocxBlob(doc: PuskesDoc, profile: FaskesProfile): Promise<{ blob: Blob; fileName: string }> {
  const sections: any[] = [];

  if (doc.useKop) {
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: profile.pemerintahDaerah.toUpperCase(),
            font: 'Arial',
            size: 24,
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: profile.dinasKesehatan.toUpperCase(),
            font: 'Arial',
            size: 26,
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: profile.namaPuskesmas.toUpperCase(),
            font: 'Arial',
            size: 30,
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        border: {
          bottom: {
            color: '000000',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 24,
          },
        },
        children: [
          new TextRun({
            text: `${profile.alamatPuskesmas} | Telp: ${profile.teleponPuskesmas} | Email: ${profile.emailPuskesmas}`,
            font: 'Arial',
            size: 18,
          }),
        ],
      })
    );
  }

  // Document Title
  sections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: doc.title.toUpperCase(),
          font: 'Arial',
          size: 28,
          bold: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `Nomor: ${doc.docNumber || '440/PKM/2026'}`,
          font: 'Arial',
          size: 20,
        }),
      ],
    })
  );

  // Sections
  (doc.sections || []).forEach((sec) => {
    sections.push(
      new Paragraph({
        spacing: { before: 180, after: 80 },
        children: [
          new TextRun({
            text: sec.title,
            font: 'Arial',
            size: 22,
            bold: true,
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: sec.content,
            font: 'Arial',
            size: 20,
          }),
        ],
      })
    );
  });

  const wordDoc = new Document({
    sections: [
      {
        properties: getPageProperties(),
        children: sections,
      },
    ],
  });

  const blob = await Packer.toBlob(wordDoc);
  const fileName = `${doc.docType}_${doc.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40)}.docx`;
  return { blob, fileName };
}

// Convert Docx Blob to Base64 Data URL for Pustaka Media storage
export async function generateDocxBase64(doc: PuskesDoc, profile: FaskesProfile): Promise<{ dataUrl: string; fileName: string; size: number }> {
  const { blob, fileName } = await generateDocxBlob(doc, profile);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({
        dataUrl: reader.result as string,
        fileName,
        size: blob.size,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
