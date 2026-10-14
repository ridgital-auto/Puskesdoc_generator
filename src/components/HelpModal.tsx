import React, { useState } from 'react';
import { X, HelpCircle, Send, Loader2, BookOpen, MessageCircleQuestion } from 'lucide-react';
import { aiAskAboutApp, APP_GUIDE_KNOWLEDGE } from '../lib/appGuide';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState<'guide' | 'ask'>('guide');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAsk = async () => {
    if (!question.trim() || isAsking) return;
    setIsAsking(true);
    setAskError(null);
    setAnswer(null);
    const res = await aiAskAboutApp(question);
    setIsAsking(false);
    if (res.success && res.answer) {
      setAnswer(res.answer);
    } else {
      setAskError(res.error || 'Gagal mendapatkan jawaban.');
    }
  };

  // Ubah markdown sederhana (#, ##, 1.) menjadi tampilan rapi
  const renderGuide = () => {
    return APP_GUIDE_KNOWLEDGE.split('\n').map((line, i) => {
      const t = line.trim();
      if (t.startsWith('## ')) {
        return <h4 key={i} className="text-sm font-bold text-purple-800 mt-5 mb-2">{t.slice(3)}</h4>;
      }
      if (t.startsWith('# ')) return null;
      if (/^\d+\.\s/.test(t)) {
        return <li key={i} className="text-xs text-slate-700 ml-4 list-decimal mb-1 leading-relaxed">{t.replace(/^\d+\.\s*/, '')}</li>;
      }
      if (t.startsWith('- ')) {
        return <li key={i} className="text-xs text-slate-700 ml-4 list-disc mb-1 leading-relaxed">{t.slice(2)}</li>;
      }
      if (!t) return <div key={i} className="h-2" />;
      return <p key={i} className="text-xs text-slate-700 mb-1.5 leading-relaxed">{t}</p>;
    });
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 text-white flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Bantuan Penggunaan Aplikasi</h3>
              <p className="text-[11px] text-purple-100">Panduan & tanya jawab seputar Puskesdoc Generator</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab */}
        <div className="flex gap-1 px-6 pt-3 border-b border-slate-200 shrink-0">
          <button
            onClick={() => setTab('guide')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-t-lg cursor-pointer ${tab === 'guide' ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50/50' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Panduan
          </button>
          <button
            onClick={() => setTab('ask')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-t-lg cursor-pointer ${tab === 'ask' ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50/50' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <MessageCircleQuestion className="w-3.5 h-3.5" /> Tanya AI
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === 'guide' ? (
            <div>{renderGuide()}</div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                Bingung cara pakai aplikasi ini? Tulis pertanyaanmu — AI akan menjawab berdasarkan panduan resmi aplikasi.
                Contoh: <em>"bagaimana cara membuat SOP?"</em>, <em>"di mana memasukkan API key?"</em>
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                  placeholder="Tulis pertanyaanmu di sini..."
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
                <button
                  onClick={handleAsk}
                  disabled={isAsking || !question.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  {isAsking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {isAsking ? '...' : 'Tanya'}
                </button>
              </div>

              {askError && (
                <div className="p-3 rounded-xl text-xs bg-rose-50 border border-rose-200 text-rose-800 leading-relaxed">
                  {askError}
                </div>
              )}

              {answer && (
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                  <p className="text-[11px] font-bold text-purple-800 mb-1.5">Jawaban AI:</p>
                  <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{answer}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
