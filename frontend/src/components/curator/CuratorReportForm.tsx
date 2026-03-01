import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../api/client';

interface Hint {
  id: number;
  field: number;
  text: string;
}

interface CuratorField {
  id: number;
  name: string;
  order: number;
  hints: Hint[];
}

interface CuratorSection {
  id: number;
  name: string;
  order: number;
  fields: CuratorField[];
}

const SECTION_COLORS = [
  'bg-indigo-600',
  'bg-violet-600',
  'bg-teal-600',
];

interface Props {
  studentId: number;
  academicYear: string;
  onSaved?: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

export default function CuratorReportForm({ studentId, academicYear, onSaved }: Props) {
  const [sections, setSections] = useState<CuratorSection[]>([]);
  const [values, setValues] = useState<Record<number, string>>({});
  // Ref всегда содержит актуальные значения для авто-сохранения (без staleness проблем)
  const valuesRef = useRef<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [structRes, reportRes] = await Promise.all([
        api.get('/curator/structure/'),
        api.get(`/curator/reports/${studentId}/`, { params: { academic_year: academicYear } }),
      ]);
      setSections(structRes.data);
      const valMap: Record<number, string> = {};
      for (const v of (reportRes.data.values ?? [])) {
        valMap[v.field] = v.value;
      }
      valuesRef.current = valMap;
      setValues(valMap);
    } finally {
      setLoading(false);
    }
  }, [studentId, academicYear]);

  useEffect(() => { load(); }, [load]);

  // Очистка таймеров при размонтировании
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const valuesList = Object.entries(valuesRef.current).map(([fieldId, value]) => ({
          field: Number(fieldId),
          value,
        }));
        await api.put(`/curator/reports/${studentId}/`, {
          values: valuesList,
          academic_year: academicYear,
        });
        setSaveStatus('saved');
        onSaved?.();
        savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('idle');
      }
    }, 1500);
  }, [studentId, academicYear, onSaved]);

  const handleChange = (fieldId: number, text: string) => {
    const newValues = { ...valuesRef.current, [fieldId]: text };
    valuesRef.current = newValues;
    setValues(newValues);
    scheduleSave();
  };

  const handleHintClick = (fieldId: number, hintText: string) => {
    const current = valuesRef.current[fieldId] ?? '';
    const newVal = current.trim() ? `${current.trim()}\n${hintText}` : hintText;
    const newValues = { ...valuesRef.current, [fieldId]: newVal };
    valuesRef.current = newValues;
    setValues(newValues);
    scheduleSave();
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-400 text-sm">Загрузка...</div>;
  }

  return (
    <div>
      {/* Статус авто-сохранения */}
      <div className="flex justify-end mb-2 h-4">
        {saveStatus === 'saving' && (
          <span className="text-xs text-gray-400">Сохранение...</span>
        )}
        {saveStatus === 'saved' && (
          <span className="text-xs text-green-600 font-medium">Сохранено ✓</span>
        )}
      </div>

      <div className="space-y-4">
        {sections.map((section, idx) => (
          <div
            key={section.id}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className={`${SECTION_COLORS[idx % SECTION_COLORS.length]} px-5 py-2.5`}>
              <h2 className="text-white font-semibold text-sm tracking-wide">{section.name}</h2>
            </div>
            <div className="p-5 space-y-5">
              {section.fields.map(field => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {field.name}
                  </label>
                  <textarea
                    rows={3}
                    value={values[field.id] ?? ''}
                    onChange={e => handleChange(field.id, e.target.value)}
                    placeholder="Введите наблюдения или выберите подсказку..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                  />
                  {field.hints.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {field.hints.map(hint => (
                        <button
                          key={hint.id}
                          type="button"
                          onClick={() => handleHintClick(field.id, hint.text)}
                          className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                        >
                          {hint.text}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
