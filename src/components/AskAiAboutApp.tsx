import React, { useState } from 'react';
import { Send, Loader2, MessageCircleQuestion } from 'lucide-react';
import { aiAskAboutApp } from '../lib/appGuide';

/**
 * Komponen "Tanya AI" — menjawab pertanyaan seputar penggunaan aplikasi ini
 * memakai Gemini 3.8 Flash + API key pribadi pengguna.
 */
export const AskAiAboutApp: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

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

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 leading-relaxed flex items-start gap-1.5">
        <MessageCircleQuestion className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
        <span>
          Bingung cara pakai aplikasi ini? Tulis pertanyaanmu — AI hanya menjawab seputar penggunaan aplikasi Puskesdoc Generator.
          Contoh: <em>"bagaimana cara membuat SOP?"</em>, <em>"di mana memasukkan API key?"</em>
        </span>
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
  );
};
