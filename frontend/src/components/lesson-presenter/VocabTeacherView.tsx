import type { Slide, VocabContent, VocabWord, VocabProgressRecord } from '../../types';

const CANVAS_W = 960;
const CANVAS_H = 540;
const VOCAB_LANG_LABELS: Record<'en' | 'kk', string> = { en: 'Английский', kk: 'Казахский' };
const VOCAB_LANG_BCP47: Record<'en' | 'kk', string>  = { en: 'en-US',      kk: 'kk-KZ'    };

function vocabSpeak(text: string, lang: 'en' | 'kk') {
  if (!text.trim()) return;
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = VOCAB_LANG_BCP47[lang];
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utt);
}

export default function VocabTeacherView({
  slide, sessionId, content,
}: {
  slide: Slide;
  sessionId: number;
  content: VocabContent;
}) {
  const [progress, setProgress] = useState<VocabProgressRecord[]>([]);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await api.get(`/lessons/sessions/${sessionId}/slides/${slide.id}/vocab-progress/`);
      setProgress(res.data);
    } catch { /* ignore */ }
  }, [sessionId, slide.id]);

  useEffect(() => {
    fetchProgress();
    const timer = setInterval(fetchProgress, 5000);
    return () => clearInterval(timer);
  }, [fetchProgress]);

  // Build student list from progress
  const studentMap: Record<number, string> = {};
  for (const r of progress) {
    if (!studentMap[r.student_id]) studentMap[r.student_id] = r.student_name;
  }
  const students = Object.entries(studentMap).map(([id, name]) => ({ id: parseInt(id), name }));

  // Build progress lookup: [student_id][word_id] → record
  const lookup: Record<number, Record<string, VocabProgressRecord>> = {};
  for (const r of progress) {
    if (!lookup[r.student_id]) lookup[r.student_id] = {};
    lookup[r.student_id][r.word_id] = r;
  }

  if (content.words.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 16 }}>
        Слов нет — добавьте слова в редакторе
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', background: '#f8fafc', padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>📚</span>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', margin: 0 }}>
          Прогресс класса — {VOCAB_LANG_LABELS[content.targetLang]}
        </h2>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>{content.words.length} слов</span>
      </div>

      {students.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: 14 }}>Нет данных — ученики ещё не начали</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 400, background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }}>Ученик</th>
                {content.words.map(w => (
                  <th key={w.id} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', maxWidth: 100 }} title={`${w.ru} — ${w.target}`}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 80 }}>{w.ru}</div>
                    <div style={{ fontWeight: 400, color: '#9ca3af', fontSize: 11 }}>{w.target}</div>
                  </th>
                ))}
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#374151', borderBottom: '2px solid #e5e7eb' }}>Итог</th>
              </tr>
            </thead>
            <tbody>
              {students.map((st, si) => {
                const learnedCount = content.words.filter(w => lookup[st.id]?.[w.id]?.learned).length;
                return (
                  <tr key={st.id} style={{ background: si % 2 ? '#f9fafb' : 'white' }}>
                    <td style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#111827', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>{st.name}</td>
                    {content.words.map(w => {
                      const rec = lookup[st.id]?.[w.id];
                      let cell: React.ReactNode = <span style={{ color: '#d1d5db' }}>—</span>;
                      let bg = 'transparent';
                      if (rec) {
                        if (rec.learned) {
                          cell = <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>;
                          bg = '#f0fdf4';
                        } else if (rec.attempts > rec.correct) {
                          cell = <span style={{ color: '#dc2626', fontSize: 12 }}>{rec.correct}/{rec.attempts}</span>;
                          bg = '#fef2f2';
                        } else {
                          cell = <span style={{ color: '#f59e0b', fontSize: 11 }}>…</span>;
                          bg = '#fffbeb';
                        }
                      }
                      return (
                        <td key={w.id} style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #f3f4f6', background: bg }}>
                          {cell}
                        </td>
                      );
                    })}
                    <td style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #f3f4f6', fontWeight: 600, color: learnedCount === content.words.length ? '#16a34a' : '#6366f1', fontSize: 13 }}>
                      {learnedCount}/{content.words.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

