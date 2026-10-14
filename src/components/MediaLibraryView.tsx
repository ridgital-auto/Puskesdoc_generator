import React, { useState, useMemo, useRef } from 'react';
import { 
  Folder, 
  Upload, 
  Download, 
  Eye, 
  Trash2, 
  Search, 
  Filter, 
  Image as ImageIcon, 
  FileText, 
  FileCheck, 
  Check, 
  Copy, 
  X, 
  Plus, 
  ZoomIn, 
  ZoomOut, 
  RotateCw,
  HardDrive,
  FileCode,
  Tag,
  AlertCircle,
  CopyX
} from 'lucide-react';
import { MediaItem } from '../types';
import { getStoredMedia, saveMediaItem, deleteMediaItem, saveAllMedia, removeDuplicateMedia } from '../utils/storage';

interface MediaLibraryViewProps {
  onInsertToTemplate?: (media: MediaItem) => void;
}

export const MediaLibraryView: React.FC<MediaLibraryViewProps> = ({ onInsertToTemplate }) => {
  const [mediaList, setMediaList] = useState<MediaItem[]>(getStoredMedia());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<'ALL' | 'image' | 'document'>('ALL');
  const [isDragOver, setIsDragOver] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Preview Modal State
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Upload Form State for extra info
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<{ file: File; dataUrl: string; name: string; category: MediaItem['category'] }[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const triggerNotice = (message: string, type: 'success' | 'error' = 'success') => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 3000);
  };

  // Filtered media
  const filteredList = useMemo(() => {
    return mediaList.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchType = selectedType === 'ALL' || item.type === selectedType;

      const matchCategory =
        selectedCategory === 'ALL' ||
        (selectedCategory === 'logo' && item.category === 'logo') ||
        (selectedCategory === 'stempel' && item.category === 'stempel') ||
        (selectedCategory === 'form' && item.category === 'form') ||
        (selectedCategory === 'sop' && (item.category === 'sop' || item.category === 'surat')) ||
        (selectedCategory === 'foto' && item.category === 'foto');

      return matchSearch && matchType && matchCategory;
    });
  }, [mediaList, searchQuery, selectedCategory, selectedType]);

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Handle files selection
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    fileArray.forEach((file) => {
      const reader = new FileReader();
      const isImg = file.type.startsWith('image/');
      const ext = file.name.split('.').pop()?.toLowerCase();

      reader.onload = (e) => {
        const dataUrl = (e.target?.result as string) || '';
        let detectedCategory: MediaItem['category'] = 'lainnya';
        if (isImg) {
          if (file.name.toLowerCase().includes('logo')) detectedCategory = 'logo';
          else if (file.name.toLowerCase().includes('stempel') || file.name.toLowerCase().includes('cap') || file.name.toLowerCase().includes('ttd')) detectedCategory = 'stempel';
          else detectedCategory = 'foto';
        } else if (ext === 'docx' || ext === 'doc') {
          if (file.name.toLowerCase().includes('form') || file.name.toLowerCase().includes('blanko')) detectedCategory = 'form';
          else detectedCategory = 'sop';
        }

        const newItem: MediaItem = {
          id: 'med_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          name: file.name,
          type: isImg ? 'image' : 'document',
          mimeType: file.type || (ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/octet-stream'),
          size: file.size,
          dataUrl,
          createdAt: new Date().toISOString(),
          category: detectedCategory,
          description: `Berkas ${isImg ? 'gambar' : 'dokumen'} diunggah ${new Date().toLocaleDateString('id-ID')}`,
        };

        saveMediaItem(newItem);
        setMediaList(getStoredMedia());
        triggerNotice(`Berkas "${file.name}" berhasil disimpan ke Pustaka Media!`);
      };

      reader.readAsDataURL(file);
    });
  };

  // Download media item
  const handleDownload = (item: MediaItem) => {
    try {
      const a = document.createElement('a');
      a.href = item.dataUrl;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      triggerNotice(`Memulai unduhan "${item.name}"...`);
    } catch (err) {
      console.error('Download error:', err);
      triggerNotice('Gagal mengunduh berkas', 'error');
    }
  };

  // Delete media item
  const handleDelete = (item: MediaItem) => {
    if (window.confirm(`Hapus berkas "${item.name}" dari Pustaka Media?`)) {
      deleteMediaItem(item.id);
      const updated = getStoredMedia();
      setMediaList(updated);
      if (previewItem?.id === item.id) setPreviewItem(null);
      triggerNotice(`Berkas "${item.name}" berhasil dihapus.`);
    }
  };

  // Copy data link / base64
  const handleCopyLink = (item: MediaItem) => {
    navigator.clipboard.writeText(item.dataUrl);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
    triggerNotice('Tautan Base64 berhasil disalin ke clipboard!');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
      {/* Toast Notice */}
      {notice && (
        <div 
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 animate-bounce ${
            notice.type === 'success' 
              ? 'bg-purple-900 text-white border-purple-700' 
              : 'bg-rose-900 text-white border-rose-700'
          }`}
        >
          {notice.type === 'success' ? <Check className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{notice.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Folder className="w-4 h-4" />
            </span>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Pustaka Media & Berkas Dokumen
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
              {mediaList.length} Berkas Tersimpan
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            Simpan gambar (logo faskes, lambang pemda, cap stempel, tanda tangan digital) serta dokumen (blanko formulir, acuan naskah .docx). Anda dapat melihat pratinjau langsung, mengunduh, dan menyisipkannya ke template kapan saja.
          </p>
        </div>

        {/* Upload Trigger Button */}
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*,.docx,.doc,.pdf,.xlsx,.txt"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => {
              const removed = removeDuplicateMedia();
              if (removed > 0) {
                setMediaList(getStoredMedia());
                triggerNotice(`${removed} gambar duplikat dihapus dari Pustaka Media.`);
              } else {
                triggerNotice('Tidak ada duplikat ditemukan — Pustaka Media sudah bersih.');
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 shadow-sm transition-all active:scale-95 cursor-pointer"
            title="Hapus gambar yang kontennya sama (duplikat)"
          >
            <CopyX className="w-4 h-4" />
            <span>Hapus Duplikat</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Unggah Media / Dokumen</span>
          </button>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
          isDragOver
            ? 'border-purple-500 bg-purple-50/80 scale-101'
            : 'border-slate-300 bg-slate-50/60 hover:bg-slate-50 hover:border-purple-300'
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
            <Upload className="w-5 h-5 animate-pulse" />
          </div>
          <p className="text-xs font-bold text-slate-700">
            Tarik & Jatuhkan (Drag and Drop) Gambar atau Dokumen di Sini
          </p>
          <p className="text-[11px] text-slate-500">
            Mendukung gambar (PNG, JPG, SVG, WebP) dan berkas dokumen (.DOCX, .PDF, .XLSX)
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama berkas atau deskripsi..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
          <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>

          <button
            type="button"
            onClick={() => { setSelectedType('ALL'); setSelectedCategory('ALL'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedType === 'ALL' && selectedCategory === 'ALL'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({mediaList.length})
          </button>

          <button
            type="button"
            onClick={() => { setSelectedType('image'); setSelectedCategory('ALL'); }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedType === 'image' && selectedCategory === 'ALL'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Gambar ({mediaList.filter(m => m.type === 'image').length})</span>
          </button>

          <button
            type="button"
            onClick={() => { setSelectedType('document'); setSelectedCategory('ALL'); }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedType === 'document' && selectedCategory === 'ALL'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Dokumen ({mediaList.filter(m => m.type === 'document').length})</span>
          </button>

          <button
            type="button"
            onClick={() => { setSelectedType('ALL'); setSelectedCategory('logo'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedCategory === 'logo'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Logo Kemenkes / Pemda
          </button>

          <button
            type="button"
            onClick={() => { setSelectedType('ALL'); setSelectedCategory('stempel'); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedCategory === 'stempel'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Stempel & TTD
          </button>
        </div>
      </div>

      {/* Media Cards Grid */}
      {filteredList.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 mx-auto flex items-center justify-center">
            <Folder className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            Tidak ada media atau dokumen ditemukan
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Coba ubah kata kunci pencarian atau unggah berkas baru menggunakan tombol di atas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredList.map((item) => {
            const isImage = item.type === 'image';
            const isWord = item.name.endsWith('.docx') || item.name.endsWith('.doc');

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 hover:border-purple-300 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Thumbnail Display */}
                <div 
                  onClick={() => { setPreviewItem(item); setPreviewZoom(1); }}
                  className="h-44 bg-slate-50 border-b border-slate-100 flex items-center justify-center p-3 relative cursor-pointer overflow-hidden group-hover:bg-slate-100/60 transition-colors"
                >
                  {isImage ? (
                    <img
                      src={item.dataUrl}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain drop-shadow-xs group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-4">
                      {isWord ? (
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mb-2 shadow-xs">
                          <FileText className="w-7 h-7" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center mb-2 shadow-xs">
                          <FileCode className="w-7 h-7" />
                        </div>
                      )}
                      <span className="text-[11px] font-bold text-slate-700 truncate max-w-[180px]">
                        {item.name}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-mono mt-0.5">
                        {isWord ? 'Microsoft Word' : 'Dokumen'}
                      </span>
                    </div>
                  )}

                  {/* Badge Category */}
                  <span className="absolute top-2.5 left-2.5 text-[9px] font-bold px-2 py-0.5 rounded-md bg-white/90 text-purple-700 border border-purple-200 backdrop-blur-xs shadow-2xs uppercase">
                    {item.category}
                  </span>

                  {/* Hover Overlay Hint */}
                  <div className="absolute inset-0 bg-purple-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <span className="bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-bold px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-md">
                      <Eye className="w-3.5 h-3.5" /> Pratinjau
                    </span>
                  </div>
                </div>

                {/* Info Block */}
                <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 
                      title={item.name}
                      className="text-xs font-bold text-slate-800 truncate"
                    >
                      {item.name}
                    </h4>
                    {item.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 font-mono">
                      <span>{formatSize(item.size)}</span>
                      <span>{new Date(item.createdAt).toLocaleDateString('id-ID')}</span>
                    </div>
                  </div>

                  {/* Quick Action to use DOCX document as template */}
                  {isWord && onInsertToTemplate && (
                    <button
                      type="button"
                      onClick={() => onInsertToTemplate(item)}
                      className="w-full my-1 py-1.5 px-2 text-[11px] font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-2xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Buka Sebagai Template</span>
                    </button>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      {/* Preview Button */}
                      <button
                        type="button"
                        onClick={() => { setPreviewItem(item); setPreviewZoom(1); }}
                        className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Lihat Pratinjau"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Download Button */}
                      <button
                        type="button"
                        onClick={() => handleDownload(item)}
                        className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Unduh Berkas ke Komputer"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {/* Copy Link Button */}
                      <button
                        type="button"
                        onClick={() => handleCopyLink(item)}
                        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Salin Data Base64"
                      >
                        {copiedId === item.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Hapus dari Pustaka Media"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PREVIEW / LIGHTBOX MODAL */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  {previewItem.type === 'image' ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 truncate max-w-md">
                    {previewItem.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {formatSize(previewItem.size)} · Kategori: {previewItem.category.toUpperCase()} · {previewItem.mimeType}
                  </p>
                </div>
              </div>

              {/* Header Action Tools */}
              <div className="flex items-center gap-2">
                {previewItem.type === 'image' && (
                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 mr-2">
                    <button
                      type="button"
                      onClick={() => setPreviewZoom((z) => Math.max(0.5, z - 0.25))}
                      className="p-1 text-slate-600 hover:text-purple-600 rounded hover:bg-slate-100"
                      title="Perkecil"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono px-1 font-bold text-slate-600">
                      {Math.round(previewZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom((z) => Math.min(3, z + 0.25))}
                      className="p-1 text-slate-600 hover:text-purple-600 rounded hover:bg-slate-100"
                      title="Perbesar"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleDownload(previewItem)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-all shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Preview Area */}
            <div className="flex-1 p-6 overflow-auto flex items-center justify-center bg-slate-900/5 min-h-[350px]">
              {previewItem.type === 'image' ? (
                <div className="overflow-auto max-h-[60vh] flex items-center justify-center p-4">
                  <img
                    src={previewItem.dataUrl}
                    alt={previewItem.name}
                    style={{ transform: `scale(${previewZoom})` }}
                    className="max-h-[55vh] max-w-full object-contain rounded-lg shadow-md transition-transform duration-150"
                  />
                </div>
              ) : (
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-xl w-full text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-700 mx-auto flex items-center justify-center">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800">
                      {previewItem.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {previewItem.description || 'Berkas dokumen tersimpan dalam sistem.'}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl text-left text-xs font-mono text-slate-600 space-y-1 border border-slate-200">
                    <p><strong>Nama:</strong> {previewItem.name}</p>
                    <p><strong>Ukuran:</strong> {formatSize(previewItem.size)}</p>
                    <p><strong>Format:</strong> {previewItem.mimeType}</p>
                    <p><strong>Diunggah:</strong> {new Date(previewItem.createdAt).toLocaleString('id-ID')}</p>
                  </div>
                  <div className="pt-2 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(previewItem)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Unduh Berkas Ini
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
              <span>{previewItem.description || 'Pustaka Media Puskesmas'}</span>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
