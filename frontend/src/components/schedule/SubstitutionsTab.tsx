import { useState, useEffect, useCallback } from 'react';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type {
  SchoolClass, TeacherOption, Room, ScheduleLesson,
  Substitution, ClassSubject, ClassGroup,
} from '../../types';
import SubstitutionsGrid from './SubstitutionsGrid';
import SubstitutionEditor from './SubstitutionEditor';

type ViewMode = 'class' | 'teacher' | 'room';

const VIEW_MODES: { key: ViewMode; label: string }[] = [
  { key: 'class', label: 'По классу' },
  { key: 'teacher', label: 'По учителю' },
  { key: 'room', label: 'По кабинету' },
];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDates(monday: Date): Date[] {
  return [0, 1, 2, 3, 4].map(i => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatWeekRange(monday: Date): string {
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  return `${monday.toLocaleDateString('ru-RU', opts)} — ${friday.toLocaleDateString('ru-RU', { ...opts, year: 'numeric' })}`;
}

interface Props {
  classes: SchoolClass[];
  teachers: TeacherOption[];
  rooms: Room[];
}

export default function SubstitutionsTab({ classes, teachers, rooms }: Props) {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>(user?.is_teacher ? 'teacher' : 'class');
  const [selectedId, setSelectedId] = useState<number | null>(user?.is_teacher ? user.id : null);
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()));

  const [allLessons, setAllLessons] = useState<ScheduleLesson[]>([]);
  const [allSubstitutions, setAllSubstitutions] = useState<Substitution[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);

  // Editor state
  const [editCell, setEditCell] = useState<{
    date: string;
    lessonNumber: number;
    originalLesson: ScheduleLesson | null;
    sub: Substitution | null;
  } | null>(null);

  const weekDates = getWeekDates(monday);
  const dateFrom = toISODate(weekDates[0]);
  const dateTo = toISODate(weekDates[4]);

  // Load all lessons once
  useEffect(() => {
    api.get('/school/schedule/all/').then(res => setAllLessons(res.data));
  }, []);

  // Load substitutions for the week
  const loadSubstitutions = useCallback(async () => {
    const res = await api.get('/school/substitutions/', {
      params: { date_from: dateFrom, date_to: dateTo },
    });
    setAllSubstitutions(res.data);
  }, [dateFrom, dateTo]);

  useEffect(() => { loadSubstitutions(); }, [loadSubstitutions]);

  // Load class subjects + groups when class changes
  useEffect(() => {
    if (viewMode === 'class' && selectedId) {
      Promise.all([
        api.get(`/school/classes/${selectedId}/subjects/`),
        api.get(`/school/classes/${selectedId}/groups/`),
      ]).then(([subjRes, groupRes]) => {
        setClassSubjects(subjRes.data);
        setClassGroups(groupRes.data);
      });
    } else {
      setClassSubjects([]);
      setClassGroups([]);
    }
  }, [viewMode, selectedId]);

  const currentOptions = viewMode === 'class'
    ? classes.map(c => ({ id: c.id, label: c.display_name }))
    : viewMode === 'teacher'
    ? teachers.map(t => ({ id: t.id, label: `${t.last_name} ${t.first_name}` }))
    : rooms.map(r => ({ id: r.id, label: r.name }));

  const prevWeek = () => {
    const d = new Date(monday);
    d.setDate(d.getDate() - 7);
    setMonday(d);
  };

  const nextWeek = () => {
    const d = new Date(monday);
    d.setDate(d.getDate() + 7);
    setMonday(d);
  };

  const goToToday = () => setMonday(getMonday(new Date()));

  const handleDateJump = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setMonday(getMonday(new Date(e.target.value + 'T00:00:00')));
    }
  };

  const handleCellClick = async (
    date: string,
    lessonNumber: number,
    originalLesson: ScheduleLesson | null,
    sub: Substitution | null,
  ) => {
    if (!user?.is_admin) return;
    // Load class subjects for the relevant class
    const classId = sub?.school_class ?? originalLesson?.school_class ?? selectedId;
    if (classId && viewMode !== 'class') {
      const [subjRes, groupRes] = await Promise.all([
        api.get(`/school/classes/${classId}/subjects/`),
        api.get(`/school/classes/${classId}/groups/`),
      ]);
      setClassSubjects(subjRes.data);
      setClassGroups(groupRes.data);
    }
    setEditCell({ date, lessonNumber, originalLesson, sub });
  };

  const handleSave = async (data: {
    school_class: number;
    subject_name: string;
    teacher: number | null;
    room: number | null;
    group: number | null;
    original_lesson: number | null;
  }) => {
    if (!editCell) return;
    await api.post('/school/substitutions/', {
      date: editCell.date,
      lesson_number: editCell.lessonNumber,
      ...data,
    });
    setEditCell(null);
    loadSubstitutions();
  };

  const handleDelete = async () => {
    if (!editCell?.sub) return;
    await api.delete(`/school/substitutions/${editCell.sub.id}/`);
    setEditCell(null);
    loadSubstitutions();
  };

  const handleExport = () => {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
    window.open(`/api/school/substitutions/export/?${params}`, '_blank');
  };

  // Substitutions filtered for the selected entity (for the grid)
  const filteredSubs = allSubstitutions.filter(s => {
    if (viewMode === 'class') return s.school_class === selectedId;
    if (viewMode === 'teacher')
      return s.teacher === selectedId ||
        allLessons.find(l => l.id === s.original_lesson)?.teacher === selectedId;
    if (viewMode === 'room')
      return s.room === selectedId ||
        allLessons.find(l => l.id === s.original_lesson)?.room === selectedId;
    return true;
  });

  const editClassId = editCell
    ? (editCell.sub?.school_class ?? editCell.originalLesson?.school_class ?? (viewMode === 'class' ? selectedId : null))
    : null;

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            onClick={prevWeek}
            className="px-3 py-1.5 rounded border bg-white text-gray-700 hover:bg-gray-50 text-sm"
          >
            ←
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 rounded border bg-white text-gray-700 hover:bg-gray-50 text-sm"
          >
            Сегодня
          </button>
          <button
            onClick={nextWeek}
            className="px-3 py-1.5 rounded border bg-white text-gray-700 hover:bg-gray-50 text-sm"
          >
            →
          </button>
        </div>
        <span className="text-sm font-medium text-gray-700">{formatWeekRange(monday)}</span>
        <input
          type="date"
          onChange={handleDateJump}
          className="border rounded px-2 py-1 text-sm text-gray-600"
          title="Перейти к дате"
        />
        {user?.is_admin && (
          <button
            onClick={handleExport}
            className="ml-auto px-3 py-1.5 rounded border bg-white text-gray-700 hover:bg-gray-50 text-sm flex items-center gap-1.5"
          >
            <span>Экспорт Excel</span>
          </button>
        )}
      </div>

      {/* View mode + entity selector */}
      <div className="flex gap-4 mb-5 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border">
          {VIEW_MODES.map(m => (
            <button
              key={m.key}
              onClick={() => { setViewMode(m.key); setSelectedId(null); }}
              className={`px-4 py-2 text-sm ${viewMode === m.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <select
          value={selectedId ?? ''}
          onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}
          className="border rounded px-3 py-2 text-sm min-w-[200px]"
        >
          <option value="">-- Выберите --</option>
          {currentOptions.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      </div>

      {!selectedId ? (
        <p className="text-gray-400 text-sm">Выберите элемент для отображения замен</p>
      ) : (
        <>
          <SubstitutionsGrid
            weekDates={weekDates}
            allLessons={allLessons}
            allSubstitutions={filteredSubs}
            viewMode={viewMode}
            selectedId={selectedId}
            onCellClick={handleCellClick}
          />

          {/* Substitutions summary for the week */}
          {filteredSubs.length > 0 && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <div className="text-sm font-medium text-amber-800 mb-1">
                Замен на этой неделе: {filteredSubs.length}
              </div>
              <div className="text-xs text-amber-600">
                {filteredSubs.map(s => (
                  <span key={s.id} className="mr-3">
                    {new Date(s.date + 'T00:00:00').toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' '}ур.{s.lesson_number}: {s.subject_name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {editCell && (
        <SubstitutionEditor
          date={editCell.date}
          lessonNumber={editCell.lessonNumber}
          originalLesson={editCell.originalLesson}
          existingSub={editCell.sub}
          teachers={teachers}
          rooms={rooms}
          classes={classes}
          classSubjects={classSubjects}
          classGroups={classGroups}
          allLessons={allLessons}
          allSubstitutions={allSubstitutions}
          currentClassId={editClassId}
          onSave={handleSave}
          onDelete={editCell.sub ? handleDelete : undefined}
          onClose={() => setEditCell(null)}
        />
      )}
    </div>
  );
}
