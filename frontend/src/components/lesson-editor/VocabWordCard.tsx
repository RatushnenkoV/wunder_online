import { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import type { VocabWord } from '../../types';

const PIXABAY_KEY = '54818244-3641622ef32cd383da65cf948';

const LANG_LABELS: Record<'en' | 'kk', string> = { en: 'Английский', kk: 'Казахский' };
const LANG_BCP47: Record<'en' | 'kk', string>  = { en: 'en-US',      kk: 'kk-KZ'    };

function speak(text: string, lang: 'en' | 'kk') {
  if (!text.trim()) return;
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = LANG_BCP47[lang];
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utt);
}

async function translateWord(ru: string, lang: 'en' | 'kk'): Promise<string[]> {
  if (!ru.trim()) return [];
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(ru)}&langpair=ru|${lang}`
    );
    const json = await res.json();
    const results: string[] = [];
    const top = (json?.responseData?.translatedText ?? '').trim();
    if (top && top.toLowerCase() !== 'no translation') results.push(top);
    const matches: { translation: string }[] = json?.matches ?? [];
    for (const m of matches) {
      const t = m.translation?.trim();
      if (t && !results.includes(t) && t.toLowerCase() !== 'no translation' && results.length < 4) {
        results.push(t);
      }
    }
    return results;
  } catch {
    return [];
  }
}

interface PixabayHit { previewURL: string; webformatURL: string; }

async function searchPixabay(query: string): Promise<PixabayHit[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(
      `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(query)}&image_type=illustration&per_page=3&safesearch=true`
    );
    const json = await res.json();
    return (json?.hits ?? []).slice(0, 3).map((h: PixabayHit) => ({
      previewURL: h.previewURL,
      webformatURL: h.webformatURL,
    }));
  } catch {
    return [];
  }
}

export default function VocabWordCard({
  word, lang, lessonId, onChange, onDelete, canDelete,
}: {
  word: VocabWord;
  lang: 'en' | 'kk';
  lessonId: number;
  onChange: (w: VocabWord) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const [suggestions, setSuggestions]       = useState<string[]>([]);
  const [translating, setTranslating]       = useState(false);
  const [pixImages, setPixImages]           = useState<PixabayHit[]>([]);
  const [searchingImg, setSearchingImg]     = useState(false);
  const [uploading, setUploading]           = useState(false);
  const translateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  // Auto-translate when ru changes (700ms debounce)
  useEffect(() => {
    if (translateTimer.current) clearTimeout(translateTimer.current);
    if (!word.ru.trim()) { setSuggestions([]); return; }
    translateTimer.current = setTimeout(async () => {
      setTranslating(true);
      const s = await translateWord(word.ru, lang);
      setSuggestions(s);
      // Auto-fill target if empty
      if (s.length > 0 && !word.target.trim()) onChange({ ...word, target: s[0] });
      setTranslating(false);
    }, 700);
    return () => { if (translateTimer.current) clearTimeout(translateTimer.current); };
  }, [word.ru, lang]); // eslint-disable-line

  // Auto-search Pixabay when target changes (700ms debounce)
  useEffect(() => {
    if (imageTimer.current) clearTimeout(imageTimer.current);
    if (!word.target.trim()) { setPixImages([]); return; }
    imageTimer.current = setTimeout(async () => {
      setSearchingImg(true);
      const imgs = await searchPixabay(word.target);
      setPixImages(imgs);
      setSearchingImg(false);
    }, 700);
    return () => { if (imageTimer.current) clearTimeout(imageTimer.current); };
  }, [word.target]); // eslint-disable-line

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/lessons/lessons/${lessonId}/upload/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange({ ...word, imageUrl: res.data.url });
    } catch { /* ignore */ }
    setUploading(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-4 space-y-3">
      {/* Строка: русское слово + перевод + кнопка удалить */}
      <div className="flex items-start gap-2">
        {/* Русское слово */}
        <div className="flex-1 min-w-0">
          <label className="text-xs text-gray-400 dark:text-slate-500 mb-1 block">Русское слово</label>
          <input
            type="text"
            value={word.ru}
            onChange={e => onChange({ ...word, ru: e.target.value })}
            placeholder="Введите слово на русском..."
            className="w-full text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-400"
          />
          {translating && <span className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 block">Переводим...</span>}
        </div>

        {/* Перевод */}
        <div className="flex-1 min-w-0">
          <label className="text-xs text-gray-400 dark:text-slate-500 mb-1 block">{LANG_LABELS[lang]}</label>
          <div className="flex gap-1">
            <input
              type="text"
              value={word.target}
              onChange={e => onChange({ ...word, target: e.target.value })}
              placeholder="Перевод..."
              className="flex-1 min-w-0 text-sm border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-400"
            />
            <button
              onClick={() => speak(word.target, lang)}
              disabled={!word.target.trim()}
              title="Озвучить"
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
            >
              🔊
            </button>
          </div>
          {/* Варианты перевода */}
          {suggestions.length > 1 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onChange({ ...word, target: s })}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${word.target === s ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:border-purple-300'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Кнопка удалить */}
        {canDelete && (
          <button
            onClick={onDelete}
            className="flex-shrink-0 mt-6 text-gray-300 dark:text-slate-600 hover:text-red-500 transition-colors text-xl leading-none"
            title="Удалить слово"
          >×</button>
        )}
      </div>

      {/* Картинки */}
      <div>
        <label className="text-xs text-gray-400 dark:text-slate-500 mb-1.5 block">Картинка (иллюстрация)</label>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Выбранная картинка */}
          {word.imageUrl && (
            <div className="relative flex-shrink-0">
              <img src={word.imageUrl} alt="" className="w-16 h-12 object-cover rounded-lg border-2 border-purple-400" />
              <button
                onClick={() => onChange({ ...word, imageUrl: '' })}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs leading-none flex items-center justify-center"
              >×</button>
            </div>
          )}

          {/* Thumbnails из Pixabay */}
          {searchingImg ? (
            <span className="text-xs text-gray-400 dark:text-slate-500">Ищем картинки...</span>
          ) : (
            pixImages.map((img, i) => (
              <button
                key={i}
                onClick={() => onChange({ ...word, imageUrl: img.webformatURL })}
                className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${word.imageUrl === img.webformatURL ? 'border-purple-500' : 'border-gray-200 dark:border-slate-700 hover:border-purple-300'}`}
                title="Выбрать картинку"
              >
                <img src={img.previewURL} alt="" className="w-full h-full object-cover" />
              </button>
            ))
          )}

          {/* Загрузить свою */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Загрузить свою картинку"
            className="flex-shrink-0 w-16 h-12 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-purple-400 flex items-center justify-center text-gray-400 dark:text-slate-500 hover:text-purple-500 transition-colors text-xl disabled:opacity-50"
          >
            {uploading ? '⏳' : '📁'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }}
          />
        </div>
        {pixImages.length === 0 && !searchingImg && word.target.trim() && (
          <span className="text-xs text-gray-400 dark:text-slate-500 mt-1 block">Нет иллюстраций на Pixabay — загрузите свою</span>
        )}
      </div>
    </div>
  );
}
