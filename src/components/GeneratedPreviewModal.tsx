import React from 'react';
import { 
  X, 
  Sparkles, 
  Download, 
  Save, 
  FolderPlus, 
  Check, 
  FileText,
  FileCheck,
  Building2,
  Calendar
} from 'lucide-react';
import { PuskesDoc, FaskesProfile } from '../types';
import { exportToDocx, generateDocxBase64 } from '../utils/docxExport';
import { saveMediaItem } from '../utils/storage';
import { PaperSizeSelector } from './PaperSizeSelector';

interface GeneratedPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  generatedDoc: PuskesDoc | null;
  profile: FaskesProfile;
  onApplyToEditor: (doc: PuskesDoc) => void;
  onNotify: (message: string) => void;
}

export const GeneratedPreviewModal: React.FC<GeneratedPreviewModalProps> = ({
  isOpen,
  onClose,
  generatedDoc,
  profile,
  onApplyToEditor,
  onNotify,
}) => {
  if (!isOpen || !generatedDoc) return null;

  const handleDownloadDocx = async () => {
    try {
      await exportToDocx(generatedDoc, profile);
      onNotify('Dokumen Word (.docx) berhasil diunduh!');
    } catch (err: any) {
      alert(`Gagal unduh dokumen Word: ${err.message}`);
    }
  };

  const handleSaveToMedia = async () => {
    try {
      const docxData = await generateDocxBase64(generatedDoc, profile);
      
      saveMediaItem({
        id: 'med_doc_' + Date.now(),
        name: docxData.fileName,
        type: 'document',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: docxData.size,
        dataUrl: docxData.dataUrl,
        createdAt: new Date().toISOString(),
        category: generatedDoc.docType === 'SOP' ? 'sop' : 'form',
        description: `Berkas Word (.docx) hasil AI: ${generatedDoc.title} (${generatedDoc.docType})`,
      });

      onNotify(`Dokumen Word "${docxData.fileName}" berhasil disimpan ke Pustaka Media!`);
    } catch (err: any) {
      alert(`Gagal menyimpan ke media: ${err.message}`);
    }
  };

  const handleApplyAndClose = () => {
    onApplyToEditor(generatedDoc);
    onNotify('Dokumen hasil generate berhasil diterapkan ke lembar kerja!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl h-[92vh] rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 via-fuchsia-700 to-indigo-700 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
              <Sparkles className="w-5 h-5 text-fuchsia-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white">
                  Preview Hasil Generate AI
                </span>
                <span className="text-xs font-bold text-fuchsia-200">
                  {generatedDoc.docType} · {generatedDoc.targetPages || 2} Halaman
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-extrabold truncate max-w-lg mt-0.5">
                {generatedDoc.title}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Top Bar */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600">
            Periksa draf hasil generate di bawah. Anda dapat langsung menerapkannya, mengunduh, atau menyimpan ke media.
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveToMedia}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-300 rounded-xl transition-all cursor-pointer"
              title="Simpan dokumen ini otomatis ke Pustaka Media faskes"
            >
              <FolderPlus className="w-4 h-4 text-teal-600" />
              <span>Simpan ke Media</span>
            </button>

            <button
              onClick={handleDownloadDocx}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-all cursor-pointer"
              title={generatedDoc.originalDocxHtml ? 'Unduh sebagai berkas Word (.doc) persis tampilan lembar kerja' : 'Unduh langsung sebagai berkas Microsoft Word (.docx)'}
            >
              <Download className="w-4 h-4 text-purple-600" />
              <span>{generatedDoc.originalDocxHtml ? 'Unduh .DOC' : 'Unduh .DOCX'}</span>
            </button>
            <PaperSizeSelector compact onNotify={onNotify} />

            <button
              onClick={handleApplyAndClose}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Terapkan ke Lembar Kerja</span>
            </button>
          </div>
        </div>

        {/* Scrollable Preview Body (A4 Style Paper View) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 flex justify-center">
          <div 
            style={{ fontFamily: 'Arial, sans-serif' }}
            className="w-full max-w-[760px] bg-white text-slate-900 p-8 sm:p-12 shadow-xl rounded-sm border border-slate-300 space-y-6 select-text"
          >
            {/* Header / Meta */}
            <div className="border-b-2 border-slate-900 pb-3">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="font-semibold">{profile.namaPuskesmas}</span>
                <span className="font-mono">{generatedDoc.docNumber || '440/PKM/2026'}</span>
              </div>
              <h1 className="text-base sm:text-lg font-black text-center text-slate-900 uppercase">
                {generatedDoc.title}
              </h1>
              <p className="text-center text-xs font-bold text-purple-800 uppercase mt-1">
                STANDAR OPERASIONAL PROSEDUR / NASKAH DINAS ILP
              </p>
            </div>

            {/* Sections */}
            <div className="space-y-5">
              {generatedDoc.sections.map((sec, idx) => (
                <div key={sec.id || idx} className="space-y-1.5">
                  <h3 className="text-xs font-bold text-slate-900 bg-slate-50 p-1.5 rounded border border-slate-200">
                    {sec.title}
                  </h3>
                  <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed pl-2 font-sans">
                    {sec.content}
                  </div>
                  {sec.images && sec.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 pl-2 pt-1">
                      {sec.images.map((gimg) => (
                        <img
                          key={gimg.id}
                          src={gimg.dataUrl}
                          alt=""
                          style={{ width: `${gimg.width || 280}px`, maxWidth: '100%', height: 'auto' }}
                          className="rounded border border-slate-200"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Sign-off */}
            <div className="pt-6 flex justify-end text-xs">
              <div className="text-right space-y-1 w-64">
                <p>Ditetapkan di: {profile.kabupatenKota}</p>
                <p>Pada tanggal : {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p className="font-bold pt-2">{profile.jabatanKepala?.toUpperCase()},</p>
                <div className="h-12" />
                <p className="font-bold underline">{profile.kepalaPuskesmas}</p>
                <p className="text-[11px]">NIP. {profile.nipKepala}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Total {generatedDoc.sections.length} bagian tersusun sesuai pedoman ILP.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
