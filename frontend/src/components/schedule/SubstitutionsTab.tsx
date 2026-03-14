import { useState, useEffect, useCallback, useRef } from 'react';
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

const LESSON_NUMBERS = [1, 2, 3, 4, 5, 6, 7];

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

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function formatWeekRange(monday: Date): string {
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  return `${monday.toLocaleDateString('ru-RU', opts)} — ${friday.toLocaleDateString('ru-RU', { ...opts, year: 'numeric' })}`;
}

const MONTHS_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function ruDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]}`;
}

function formatExportFilename(from: string, to: string): string {
  const year = new Date(to + 'T00:00:00').getFullYear();
  if (from === to) return `${ruDay(from)} ${year}`;
  return `${ruDay(from)} - ${ruDay(to)} ${year}`;
}

/** Shared print styles injected into generated print pages */
const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #111; }
  h1 { font-size: 16px; margin-bottom: 4px; }
  .subtitle { color: #555; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f3f4f6; text-align: left; padding: 6px 8px; border: 1px solid #d1d5db; font-size: 11px; }
  td { padding: 5px 8px; border: 1px solid #e5e7eb; vertical-align: middle; }
  td.num { text-align: center; font-weight: bold; width: 30px; }
  th.num { width: 30px; }
  .sub-row td { background: #fffbeb; border-top: 2px solid #d97706 !important; border-bottom: 2px solid #d97706 !important; }
  .sub-row td:first-child { border-left: 3px solid #d97706 !important; }
  .sub-row td:last-child { border-right: 3px solid #d97706 !important; }
  .badge { display: inline-block; background: #d97706; color: white; font-size: 9px; padding: 1px 5px; border-radius: 2px; vertical-align: middle; margin-left: 4px; font-weight: bold; letter-spacing: 0.3px; }
  .group { color: #2563eb; font-size: 10px; }
  .orig { color: #9ca3af; font-size: 10px; }
  .empty { text-align: center; color: #9ca3af; padding: 20px; }
  @media print { body { margin: 10px; } }
`;

/** Build pairs of (lesson, sub) for a given lesson number within a set of lessons/subs.
 *  Returns sorted array ready for row rendering. */
function buildPairs(
  numLessons: ScheduleLesson[],
  numSubs: Substitution[],
): Array<{ lesson: ScheduleLesson | null; sub: Substitution | null }> {
  const matched = new Set<number>();
  const pairs: Array<{ lesson: ScheduleLesson | null; sub: Substitution | null }> = [];

  numLessons.forEach(lesson => {
    const sub = numSubs.find(s =>
      !matched.has(s.id) &&
      s.school_class === lesson.school_class &&
      (s.group === lesson.group || s.original_lesson === lesson.id),
    ) ?? null;
    if (sub) matched.add(sub.id);
    pairs.push({ lesson, sub });
  });

  numSubs.filter(s => !matched.has(s.id)).forEach(sub => {
    pairs.push({ lesson: null, sub });
  });

  return pairs.sort((a, b) => {
    const aName = a.lesson?.class_name ?? a.sub?.class_name ?? '';
    const bName = b.lesson?.class_name ?? b.sub?.class_name ?? '';
    return aName.localeCompare(bName, 'ru');
  });
}

/** Generate a single print row for a lesson/sub pair (class-centric view). */
function buildRow(
  num: number,
  lesson: ScheduleLesson | null,
  sub: Substitution | null,
  showClass: boolean,
): string {
  const isSub = !!sub;
  const className = lesson?.class_name ?? sub?.class_name ?? '—';
  const groupName = lesson?.group_name ?? sub?.group_name;
  const subject = sub ? sub.subject_name : (lesson?.subject_name ?? '—');
  const teacher = sub ? (sub.teacher_name ?? '—') : (lesson?.teacher_name ?? '—');
  const room = sub ? (sub.room_name ?? '—') : (lesson?.room_name ?? '—');
  const classCell = showClass
    ? `<td>${className}${groupName ? ` <span class="group">(${groupName})</span>` : ''}</td>`
    : `<td>${groupName ? `<span class="group">${groupName}</span>` : '—'}</td>`;
  const subjectCell = `<td>${subject}${isSub ? ' <span class="badge">ЗАМЕНА</span>' : ''}</td>`;
  const origCell = isSub
    ? `<td class="orig">${sub!.original_subject_name ?? '—'}<br>${sub!.original_teacher_name ?? ''}</td>`
    : '<td class="orig">—</td>';

  return `<tr class="${isSub ? 'sub-row' : ''}">
    <td class="num">${num}</td>
    ${classCell}
    ${subjectCell}
    <td>${teacher}</td>
    <td>${room}</td>
    ${origCell}
  </tr>`;
}

/** Generate a single print row for teacher-centric view (no teacher column). */
function buildTeacherRow(
  num: number,
  lesson: ScheduleLesson | null,
  sub: Substitution | null,
): string {
  const isSub = !!sub;
  const className = lesson?.class_name ?? sub?.class_name ?? '—';
  const groupName = lesson?.group_name ?? sub?.group_name;
  const subject = sub ? sub.subject_name : (lesson?.subject_name ?? '—');
  const room = sub ? (sub.room_name ?? '—') : (lesson?.room_name ?? '—');
  const classCell = `<td>${className}${groupName ? ` <span class="group">(${groupName})</span>` : ''}</td>`;
  const subjectCell = `<td>${subject}${isSub ? ' <span class="badge">ЗАМЕНА</span>' : ''}</td>`;
  const origCell = isSub
    ? `<td class="orig">${sub!.original_subject_name ?? '—'}<br>${sub!.original_teacher_name ?? ''}</td>`
    : '<td class="orig">—</td>';

  return `<tr class="${isSub ? 'sub-row' : ''}">
    <td class="num">${num}</td>
    ${classCell}
    ${subjectCell}
    <td>${room}</td>
    ${origCell}
  </tr>`;
}

/** Open a new window, write HTML and trigger print. */
function openPrintWindow(html: string) {
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.print();
  }
}

const CARD_STYLES = `
  ${PRINT_STYLES}
  .class-card { padding: 16px 20px; }
  .page-break { page-break-before: always; }
  .card-header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
  .class-name { font-size: 22px; font-weight: bold; }
  .card-date { font-size: 12px; color: #555; }
  @media print { body { margin: 0; } .class-card { padding: 12px 16px; } }
`;

interface Props {
  classes: SchoolClass[];
  teachers: TeacherOption[];
  rooms: Room[];
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

function getWorkday(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const day = r.getDay();
  if (day === 6) r.setDate(r.getDate() + 2);
  else if (day === 0) r.setDate(r.getDate() + 1);
  return r;
}

export default function SubstitutionsTab({ classes, teachers, rooms }: Props) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>(user?.is_teacher ? 'teacher' : 'class');
  const [selectedId, setSelectedId] = useState<number | null>(user?.is_teacher ? user.id : null);
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()));

  // Mobile: single-day navigation
  const [mobileDate, setMobileDate] = useState<Date>(() => getWorkday(new Date()));

  const prevMobileDay = () => {
    const d = new Date(mobileDate);
    d.setDate(d.getDate() - 1);
    if (d.getDay() === 0) d.setDate(d.getDate() - 2);
    else if (d.getDay() === 6) d.setDate(d.getDate() - 1);
    setMobileDate(d);
    const m = getMonday(d);
    if (m.getTime() !== monday.getTime()) setMonday(m);
  };

  const nextMobileDay = () => {
    const d = new Date(mobileDate);
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    setMobileDate(d);
    const m = getMonday(d);
    if (m.getTime() !== monday.getTime()) setMonday(m);
  };

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

  // Print-all-classes menu state
  const [showPrintAllMenu, setShowPrintAllMenu] = useState(false);
  const [printAllDate, setPrintAllDate] = useState(todayISO);
  const printAllMenuRef = useRef<HTMLDivElement>(null);

  // Print-all-teachers menu state
  const [showPrintTeachersMenu, setShowPrintTeachersMenu] = useState(false);
  const [printTeachersDate, setPrintTeachersDate] = useState(todayISO);
  const printTeachersMenuRef = useRef<HTMLDivElement>(null);

  // Export menu state
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState(todayISO);
  const [exportDateTo, setExportDateTo] = useState(todayISO);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Combined mobile menu state
  const [showCombinedMenu, setShowCombinedMenu] = useState(false);
  const combinedMenuRef = useRef<HTMLDivElement>(null);

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

  // Close dropdowns on outside click
  useEffect(() => {
    if (!showPrintAllMenu) return;
    const handler = (e: MouseEvent) => {
      if (printAllMenuRef.current && !printAllMenuRef.current.contains(e.target as Node))
        setShowPrintAllMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPrintAllMenu]);

  useEffect(() => {
    if (!showPrintTeachersMenu) return;
    const handler = (e: MouseEvent) => {
      if (printTeachersMenuRef.current && !printTeachersMenuRef.current.contains(e.target as Node))
        setShowPrintTeachersMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPrintTeachersMenu]);

  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node))
        setShowExportMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  useEffect(() => {
    if (!showCombinedMenu) return;
    const handler = (e: MouseEvent) => {
      if (combinedMenuRef.current && !combinedMenuRef.current.contains(e.target as Node))
        setShowCombinedMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCombinedMenu]);

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
      const d = new Date(e.target.value + 'T00:00:00');
      setMonday(getMonday(d));
      setMobileDate(getWorkday(d));
    }
  };

  const handleCellClick = async (
    date: string,
    lessonNumber: number,
    originalLesson: ScheduleLesson | null,
    sub: Substitution | null,
  ) => {
    if (!user?.is_admin) return;
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

  /** Print the schedule for a single day column, filtered by the current view mode and selection. */
  const handlePrintDay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const weekday = date.getDay();

    const allDaySubs = allSubstitutions.filter(s => s.date === dateStr);
    const allDayLessons = allLessons.filter(l => l.weekday === weekday);

    let dayLessons = allDayLessons;
    let daySubs = allDaySubs;
    let entityLabel = '';
    let showClass = true;

    if (selectedId) {
      if (viewMode === 'class') {
        dayLessons = allDayLessons.filter(l => l.school_class === selectedId);
        daySubs = allDaySubs.filter(s => s.school_class === selectedId);
        const cls = classes.find(c => c.id === selectedId);
        entityLabel = cls ? `Класс ${cls.display_name}` : '';
        showClass = false;
      } else if (viewMode === 'teacher') {
        dayLessons = allDayLessons.filter(l => l.teacher === selectedId);
        daySubs = allDaySubs.filter(s =>
          s.teacher === selectedId ||
          allLessons.find(l => l.id === s.original_lesson)?.teacher === selectedId,
        );
        const t = teachers.find(t => t.id === selectedId);
        entityLabel = t ? `${t.last_name} ${t.first_name}` : '';
        showClass = true;
      } else if (viewMode === 'room') {
        dayLessons = allDayLessons.filter(l => l.room === selectedId);
        daySubs = allDaySubs.filter(s =>
          s.room === selectedId ||
          allLessons.find(l => l.id === s.original_lesson)?.room === selectedId,
        );
        const r = rooms.find(r => r.id === selectedId);
        entityLabel = r ? `Кабинет ${r.name}` : '';
        showClass = true;
      }
    }

    const dateLabel = date.toLocaleDateString('ru-RU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const title = entityLabel ? `Расписание — ${entityLabel}` : 'Расписание на день';
    const secondColHeader = showClass ? '<th>Класс</th>' : '<th>Гр.</th>';

    const rows: string[] = [];
    for (const num of LESSON_NUMBERS) {
      const numLessons = dayLessons.filter(l => l.lesson_number === num);
      const numSubs = daySubs.filter(s => s.lesson_number === num);
      if (numLessons.length === 0 && numSubs.length === 0) continue;
      buildPairs(numLessons, numSubs).forEach(({ lesson, sub }) => {
        rows.push(buildRow(num, lesson, sub, showClass));
      });
    }

    const html = `<!DOCTYPE html><html lang="ru"><head>
  <meta charset="UTF-8">
  <title>${title} — ${dateLabel}</title>
  <style>${PRINT_STYLES}</style>
</head><body>
  <h1>${title}</h1>
  <div class="subtitle">${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</div>
  <table>
    <thead>
      <tr>
        <th class="num">№</th>${secondColHeader}<th>Предмет</th>
        <th>Учитель</th><th>Кабинет</th><th>Отменённый урок</th>
      </tr>
    </thead>
    <tbody>${rows.join('') || '<tr><td colspan="6" class="empty">Нет уроков</td></tr>'}</tbody>
  </table>
</body></html>`;

    openPrintWindow(html);
  };

  /** Print per-class schedule cards for a given date. Only prints classes that have substitutions. */
  const handlePrintAll = async () => {
    setShowPrintAllMenu(false);

    const date = new Date(printAllDate + 'T00:00:00');
    const weekday = date.getDay();

    const res = await api.get('/school/substitutions/', {
      params: { date_from: printAllDate, date_to: printAllDate },
    });
    const dateSubs: Substitution[] = res.data;
    const dayLessons = allLessons.filter(l => l.weekday === weekday);

    const dateLabel = date.toLocaleDateString('ru-RU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    // Only classes that have at least one substitution
    const classIds = [...new Set(dateSubs.map(s => s.school_class))];

    const classMap = new Map(classes.map(c => [c.id, c]));
    classIds.sort((a, b) =>
      (classMap.get(a)?.display_name ?? '').localeCompare(classMap.get(b)?.display_name ?? '', 'ru'),
    );

    const sections = classIds.map((classId, idx) => {
      const cls = classMap.get(classId);
      const classLessons = dayLessons.filter(l => l.school_class === classId);
      const classSubs = dateSubs.filter(s => s.school_class === classId);

      const rows: string[] = [];
      for (const num of LESSON_NUMBERS) {
        const numLessons = classLessons.filter(l => l.lesson_number === num);
        const numSubs = classSubs.filter(s => s.lesson_number === num);
        if (numLessons.length === 0 && numSubs.length === 0) continue;
        buildPairs(numLessons, numSubs).forEach(({ lesson, sub }) => {
          rows.push(buildRow(num, lesson, sub, false));
        });
      }

      if (rows.length === 0) return '';

      return `<div class="class-card${idx > 0 ? ' page-break' : ''}">
  <div class="card-header">
    <span class="class-name">${cls?.display_name ?? `Класс ${classId}`}</span>
    <span class="card-date">${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th class="num">№</th><th>Гр.</th><th>Предмет</th>
        <th>Учитель</th><th>Кабинет</th><th>Отменённый урок</th>
      </tr>
    </thead>
    <tbody>${rows.join('')}</tbody>
  </table>
</div>`;
    }).filter(Boolean);

    if (sections.length === 0) {
      alert('Нет замен для выбранной даты');
      return;
    }

    const html = `<!DOCTYPE html><html lang="ru"><head>
  <meta charset="UTF-8">
  <title>Расписание по классам — ${dateLabel}</title>
  <style>${CARD_STYLES}</style>
</head><body>
  ${sections.join('')}
</body></html>`;

    openPrintWindow(html);
  };

  /** Print per-teacher schedule cards for a given date. Only prints teachers that have substitutions. */
  const handlePrintAllTeachers = async () => {
    setShowPrintTeachersMenu(false);

    const date = new Date(printTeachersDate + 'T00:00:00');
    const weekday = date.getDay();

    const res = await api.get('/school/substitutions/', {
      params: { date_from: printTeachersDate, date_to: printTeachersDate },
    });
    const dateSubs: Substitution[] = res.data;
    const dayLessons = allLessons.filter(l => l.weekday === weekday);

    const dateLabel = date.toLocaleDateString('ru-RU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    // Collect teacher IDs involved in substitutions (replacement or original)
    const teacherIdSet = new Set<number>();
    dateSubs.forEach(s => {
      if (s.teacher != null) teacherIdSet.add(s.teacher);
      const origTeacher = dayLessons.find(l => l.id === s.original_lesson)?.teacher;
      if (origTeacher != null) teacherIdSet.add(origTeacher);
    });

    const teacherMap = new Map(teachers.map(t => [t.id, t]));
    const teacherIds = [...teacherIdSet].sort((a, b) => {
      const ta = teacherMap.get(a);
      const tb = teacherMap.get(b);
      return (ta ? `${ta.last_name} ${ta.first_name}` : '').localeCompare(
        tb ? `${tb.last_name} ${tb.first_name}` : '', 'ru',
      );
    });

    const sections = teacherIds.map((teacherId, idx) => {
      const teacher = teacherMap.get(teacherId);
      const teacherLessons = dayLessons.filter(l => l.teacher === teacherId);
      const teacherSubs = dateSubs.filter(s =>
        s.teacher === teacherId ||
        dayLessons.find(l => l.id === s.original_lesson)?.teacher === teacherId,
      );

      const rows: string[] = [];
      for (const num of LESSON_NUMBERS) {
        const numLessons = teacherLessons.filter(l => l.lesson_number === num);
        const numSubs = teacherSubs.filter(s => s.lesson_number === num);
        if (numLessons.length === 0 && numSubs.length === 0) continue;
        buildPairs(numLessons, numSubs).forEach(({ lesson, sub }) => {
          rows.push(buildTeacherRow(num, lesson, sub));
        });
      }

      if (rows.length === 0) return '';

      const teacherName = teacher
        ? `${teacher.last_name} ${teacher.first_name}`
        : `Учитель ${teacherId}`;

      return `<div class="class-card${idx > 0 ? ' page-break' : ''}">
  <div class="card-header">
    <span class="class-name">${teacherName}</span>
    <span class="card-date">${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}</span>
  </div>
  <table>
    <thead>
      <tr>
        <th class="num">№</th><th>Класс</th><th>Предмет</th>
        <th>Кабинет</th><th>Отменённый урок</th>
      </tr>
    </thead>
    <tbody>${rows.join('')}</tbody>
  </table>
</div>`;
    }).filter(Boolean);

    if (sections.length === 0) {
      alert('Нет замен для выбранной даты');
      return;
    }

    const html = `<!DOCTYPE html><html lang="ru"><head>
  <meta charset="UTF-8">
  <title>Расписание по учителям — ${dateLabel}</title>
  <style>${CARD_STYLES}</style>
</head><body>
  ${sections.join('')}
</body></html>`;

    openPrintWindow(html);
  };

  const handleExport = async () => {
    setShowExportMenu(false);
    const params = new URLSearchParams({ date_from: exportDateFrom, date_to: exportDateTo });
    const response = await api.get(`/school/substitutions/export/?${params}`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formatExportFilename(exportDateFrom, exportDateTo)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
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
        <div className="hidden sm:flex items-center gap-1">
          <button
            onClick={prevWeek}
            className="px-3 py-1.5 rounded border bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm"
          >
            ←
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 rounded border bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm"
          >
            Сегодня
          </button>
          <button
            onClick={nextWeek}
            className="px-3 py-1.5 rounded border bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm"
          >
            →
          </button>
        </div>
        <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-slate-300">{formatWeekRange(monday)}</span>
        <input
          type="date"
          value={toISODate(mobileDate)}
          onChange={handleDateJump}
          className="border rounded px-2 py-1 text-sm text-gray-600 dark:text-slate-400"
          title="Перейти к дате"
        />

        {user?.is_admin && (
          <div className="ml-auto flex items-center gap-2">

            {/* Mobile: combined print & export dropdown */}
            <div className="sm:hidden relative" ref={combinedMenuRef}>
              <button
                onClick={() => setShowCombinedMenu(v => !v)}
                className="px-3 py-1.5 rounded border bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                <span>Печать и экспорт</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {showCombinedMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border rounded-lg shadow-lg p-3 z-20 min-w-[230px]">
                  {/* Print by classes */}
                  <div className="mb-3 pb-3 border-b border-gray-100 dark:border-slate-700">
                    <div className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Печать по классам</div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Дата</label>
                    <input
                      type="date"
                      value={printAllDate}
                      onChange={e => setPrintAllDate(e.target.value)}
                      className="border rounded px-2 py-1.5 text-sm w-full mb-2"
                    />
                    <button
                      onClick={() => { setShowCombinedMenu(false); handlePrintAll(); }}
                      className="w-full px-3 py-1.5 rounded bg-gray-800 dark:bg-slate-700 text-white text-sm hover:bg-gray-900 flex items-center justify-center gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 6 2 18 2 18 9"/>
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                        <rect x="6" y="14" width="12" height="8"/>
                      </svg>
                      Распечатать
                    </button>
                  </div>
                  {/* Print by teachers */}
                  <div className="mb-3 pb-3 border-b border-gray-100 dark:border-slate-700">
                    <div className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Печать по учителям</div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Дата</label>
                    <input
                      type="date"
                      value={printTeachersDate}
                      onChange={e => setPrintTeachersDate(e.target.value)}
                      className="border rounded px-2 py-1.5 text-sm w-full mb-2"
                    />
                    <button
                      onClick={() => { setShowCombinedMenu(false); handlePrintAllTeachers(); }}
                      className="w-full px-3 py-1.5 rounded bg-gray-800 dark:bg-slate-700 text-white text-sm hover:bg-gray-900 flex items-center justify-center gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 6 2 18 2 18 9"/>
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                        <rect x="6" y="14" width="12" height="8"/>
                      </svg>
                      Распечатать
                    </button>
                  </div>
                  {/* Export Excel */}
                  <div>
                    <div className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Экспорт Excel</div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">С даты</label>
                    <input
                      type="date"
                      value={exportDateFrom}
                      onChange={e => setExportDateFrom(e.target.value)}
                      className="border rounded px-2 py-1.5 text-sm w-full mb-2"
                    />
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">По дату</label>
                    <input
                      type="date"
                      value={exportDateTo}
                      min={exportDateFrom}
                      onChange={e => setExportDateTo(e.target.value)}
                      className="border rounded px-2 py-1.5 text-sm w-full mb-2"
                    />
                    <button
                      onClick={() => { setShowCombinedMenu(false); handleExport(); }}
                      className="w-full px-3 py-1.5 rounded bg-green-700 text-white text-sm hover:bg-green-800 flex items-center justify-center gap-1.5"
                    >
                      Скачать
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop: 3 separate dropdowns */}
            <div className="hidden sm:flex items-center gap-2">

            {/* Print all classes by date */}
            <div className="relative" ref={printAllMenuRef}>
              <button
                onClick={() => { setShowPrintAllMenu(v => !v); setShowPrintTeachersMenu(false); setShowExportMenu(false); }}
                className="px-3 py-1.5 rounded border bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                <span>Печать по классам</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {showPrintAllMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border rounded-lg shadow-lg p-3 z-20 min-w-[210px]">
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1 font-medium">Дата</label>
                  <input
                    type="date"
                    value={printAllDate}
                    onChange={e => setPrintAllDate(e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm w-full mb-3"
                  />
                  <button
                    onClick={handlePrintAll}
                    className="w-full px-3 py-1.5 rounded bg-gray-800 dark:bg-slate-700 text-white text-sm hover:bg-gray-900 flex items-center justify-center gap-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9"/>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                      <rect x="6" y="14" width="12" height="8"/>
                    </svg>
                    Распечатать
                  </button>
                </div>
              )}
            </div>

            {/* Print all teachers by date */}
            <div className="relative" ref={printTeachersMenuRef}>
              <button
                onClick={() => { setShowPrintTeachersMenu(v => !v); setShowPrintAllMenu(false); setShowExportMenu(false); }}
                className="px-3 py-1.5 rounded border bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm flex items-center gap-1.5"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                <span>Печать по учителям</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {showPrintTeachersMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border rounded-lg shadow-lg p-3 z-20 min-w-[210px]">
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1 font-medium">Дата</label>
                  <input
                    type="date"
                    value={printTeachersDate}
                    onChange={e => setPrintTeachersDate(e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm w-full mb-3"
                  />
                  <button
                    onClick={handlePrintAllTeachers}
                    className="w-full px-3 py-1.5 rounded bg-gray-800 dark:bg-slate-700 text-white text-sm hover:bg-gray-900 flex items-center justify-center gap-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9"/>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                      <rect x="6" y="14" width="12" height="8"/>
                    </svg>
                    Распечатать
                  </button>
                </div>
              )}
            </div>

            {/* Export Excel with date range */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => { setShowExportMenu(v => !v); setShowPrintAllMenu(false); setShowPrintTeachersMenu(false); }}
                className="px-3 py-1.5 rounded border bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm flex items-center gap-1.5"
              >
                <span>Экспорт Excel</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {showExportMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border rounded-lg shadow-lg p-3 z-20 min-w-[230px]">
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1 font-medium">С даты</label>
                  <input
                    type="date"
                    value={exportDateFrom}
                    onChange={e => setExportDateFrom(e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm w-full mb-2"
                  />
                  <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1 font-medium">По дату</label>
                  <input
                    type="date"
                    value={exportDateTo}
                    min={exportDateFrom}
                    onChange={e => setExportDateTo(e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm w-full mb-3"
                  />
                  <button
                    onClick={handleExport}
                    className="w-full px-3 py-1.5 rounded bg-green-700 text-white text-sm hover:bg-green-800 flex items-center justify-center gap-1.5"
                  >
                    Скачать
                  </button>
                </div>
              )}
            </div>

            </div>{/* end desktop flex */}
          </div>
        )}
      </div>

      {/* View mode + entity selector */}
      <div className="flex gap-4 mb-5 flex-wrap">
        <div className="flex rounded-lg overflow-hidden border">
          {VIEW_MODES.map(m => (
            <button
              key={m.key}
              onClick={() => { setViewMode(m.key); setSelectedId(null); }}
              className={`px-4 py-2 text-sm ${viewMode === m.key ? 'bg-purple-600 text-white' : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
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
        <p className="text-gray-400 dark:text-slate-500 text-sm">Выберите элемент для отображения замен</p>
      ) : (
        <>
          {/* Mobile: single-day navigation */}
          {isMobile && (
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMobileDay} className="px-3 py-1.5 rounded border bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 text-sm">←</button>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300 capitalize">
                {mobileDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
                {toISODate(mobileDate) === todayISO() && <span className="ml-2 text-xs text-purple-500">Сегодня</span>}
              </span>
              <button onClick={nextMobileDay} className="px-3 py-1.5 rounded border bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 text-sm">→</button>
            </div>
          )}
          <SubstitutionsGrid
            weekDates={isMobile ? [mobileDate] : weekDates}
            allLessons={allLessons}
            allSubstitutions={filteredSubs}
            viewMode={viewMode}
            selectedId={selectedId}
            onCellClick={handleCellClick}
            onPrintDay={isMobile ? undefined : handlePrintDay}
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

