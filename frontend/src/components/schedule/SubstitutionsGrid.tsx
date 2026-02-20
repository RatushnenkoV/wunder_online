import type { ScheduleLesson, Substitution } from '../../types';

const LESSON_NUMBERS = [1, 2, 3, 4, 5, 6, 7];

interface Props {
  weekDates: Date[];
  allLessons: ScheduleLesson[];
  allSubstitutions: Substitution[];
  viewMode: 'class' | 'teacher' | 'room';
  selectedId: number | null;
  onCellClick: (
    date: string,
    lessonNumber: number,
    originalLesson: ScheduleLesson | null,
    sub: Substitution | null,
  ) => void;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function toISODate(d: Date): string {
  // Use local date to avoid timezone shift
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export default function SubstitutionsGrid({
  weekDates, allLessons, allSubstitutions, viewMode, selectedId, onCellClick,
}: Props) {
  const today = toISODate(new Date());

  const getLessonsForCell = (weekday: number, lessonNumber: number): ScheduleLesson[] => {
    return allLessons.filter(l => {
      if (l.weekday !== weekday || l.lesson_number !== lessonNumber) return false;
      if (viewMode === 'class') return l.school_class === selectedId;
      if (viewMode === 'teacher') return l.teacher === selectedId;
      if (viewMode === 'room') return l.room === selectedId;
      return false;
    });
  };

  // Get all substitutions visible for the current view filter for this cell
  const getSubsForCell = (dateStr: string, lessonNumber: number, regularLessons: ScheduleLesson[]): Substitution[] => {
    return allSubstitutions.filter(s => {
      if (s.date !== dateStr || s.lesson_number !== lessonNumber) return false;
      if (viewMode === 'class') return s.school_class === selectedId;
      if (viewMode === 'teacher') {
        // Show if new teacher is this one, or original lesson had this teacher
        const origLesson = regularLessons.find(l => l.id === s.original_lesson);
        return s.teacher === selectedId || origLesson?.teacher === selectedId;
      }
      if (viewMode === 'room') {
        const origLesson = regularLessons.find(l => l.id === s.original_lesson);
        return s.room === selectedId || origLesson?.room === selectedId;
      }
      return false;
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: '6px' }}>
        <thead>
          <tr>
            <th className="px-3 py-2 text-sm font-medium text-gray-500 w-12">#</th>
            {weekDates.map(d => {
              const ds = toISODate(d);
              const isToday = ds === today;
              return (
                <th key={ds} className={`px-3 py-2 text-sm font-medium min-w-[160px] ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                  <div className={`capitalize ${isToday ? 'font-bold' : ''}`}>{formatDate(d)}</div>
                  {isToday && <div className="text-xs text-blue-400 font-normal">Сегодня</div>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {LESSON_NUMBERS.map(num => (
            <tr key={num}>
              <td className="px-3 py-2 text-sm font-medium text-gray-500 text-center">{num}</td>
              {weekDates.map(d => {
                const ds = toISODate(d);
                const weekday = d.getDay(); // 1=Mon...5=Fri
                const regularLessons = getLessonsForCell(weekday, num);
                const subs = getSubsForCell(ds, num, regularLessons);

                return (
                  <td key={ds} className="align-top h-[74px] p-0">
                    <CellContent
                      dateStr={ds}
                      lessonNumber={num}
                      regularLessons={regularLessons}
                      subs={subs}
                      viewMode={viewMode}
                      onCellClick={onCellClick}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CellContentProps {
  dateStr: string;
  lessonNumber: number;
  regularLessons: ScheduleLesson[];
  subs: Substitution[];
  viewMode: 'class' | 'teacher' | 'room';
  onCellClick: (date: string, lessonNumber: number, originalLesson: ScheduleLesson | null, sub: Substitution | null) => void;
}

function CellContent({ dateStr, lessonNumber, regularLessons, subs, viewMode, onCellClick }: CellContentProps) {
  // Split layout only for class view: in teacher/room view each participant has exactly one lesson per slot
  const isSplit = viewMode === 'class' && (regularLessons.length > 1 || regularLessons.some(l => l.group !== null));

  if (isSplit) {
    // Build pairs: each regular lesson with its substitution (matched by group or original_lesson id)
    const pairs = regularLessons.map(lesson => {
      const sub = subs.find(s =>
        s.group === lesson.group ||
        s.original_lesson === lesson.id,
      ) ?? null;
      return { lesson, sub };
    });

    // Also include subs that have no matching regular lesson (e.g., sub for a group not in view filter)
    const matchedSubIds = new Set(pairs.map(p => p.sub?.id).filter(Boolean));
    const extraSubs = subs.filter(s => !matchedSubIds.has(s.id));

    return (
      <div className="flex gap-px h-full rounded-lg overflow-hidden">
        {pairs.map((pair, i) => (
          <HalfCard
            key={`half-${i}`}
            lesson={pair.lesson}
            sub={pair.sub}
            side={pairs.length === 2 ? (i === 0 ? 'left' : 'right') : 'full'}
            viewMode={viewMode}
            onClick={() => onCellClick(dateStr, lessonNumber, pair.lesson, pair.sub)}
          />
        ))}
        {extraSubs.map(sub => (
          <HalfCard
            key={`extra-${sub.id}`}
            lesson={null}
            sub={sub}
            side="full"
            viewMode={viewMode}
            onClick={() => onCellClick(dateStr, lessonNumber, null, sub)}
          />
        ))}
      </div>
    );
  }

  // Single lesson (no group split)
  const lesson = regularLessons[0] ?? null;
  const sub = subs.find(s => !s.group) ?? subs[0] ?? null;

  if (!lesson && !sub) {
    return (
      <div
        onClick={() => onCellClick(dateStr, lessonNumber, null, null)}
        className="rounded-lg h-full bg-gray-100 hover:bg-amber-50 cursor-pointer transition flex items-center justify-center"
      >
        <span className="text-gray-300 text-xs">+</span>
      </div>
    );
  }

  return (
    <div
      onClick={() => onCellClick(dateStr, lessonNumber, lesson, sub)}
      className={`rounded-lg px-2 py-1.5 h-full text-xs leading-tight cursor-pointer transition ${
        sub
          ? 'bg-amber-50 border border-amber-200 hover:border-amber-400'
          : 'bg-white border border-gray-100 hover:border-amber-300 shadow-sm'
      }`}
    >
      {sub ? (
        <>
          <div className="text-[10px] font-medium text-amber-600 mb-0.5">ЗАМЕНА</div>
          <div className="font-medium text-amber-900 truncate">{sub.subject_name}</div>
          {viewMode !== 'class' && <div className="text-amber-700 truncate">{sub.class_name}</div>}
          {viewMode !== 'teacher' && sub.teacher_name && <div className="text-amber-700 truncate">{sub.teacher_name}</div>}
          {viewMode !== 'room' && sub.room_name && <div className="text-amber-600 truncate">каб. {sub.room_name}</div>}
        </>
      ) : (
        <>
          <div className="font-medium text-gray-900 truncate">{lesson!.subject_name}</div>
          {viewMode !== 'class' && <div className="text-gray-500 truncate">{lesson!.class_name}</div>}
          {viewMode !== 'teacher' && lesson!.teacher_name && <div className="text-gray-500 truncate">{lesson!.teacher_name}</div>}
          {viewMode !== 'room' && lesson!.room_name && <div className="text-gray-400 truncate">каб. {lesson!.room_name}</div>}
        </>
      )}
    </div>
  );
}

interface HalfCardProps {
  lesson: ScheduleLesson | null;
  sub: Substitution | null;
  side: 'left' | 'right' | 'full';
  viewMode: 'class' | 'teacher' | 'room';
  onClick: () => void;
}

function HalfCard({ lesson, sub, side, viewMode, onClick }: HalfCardProps) {
  const roundedClass = side === 'left' ? 'rounded-l-lg' : side === 'right' ? 'rounded-r-lg' : 'rounded-lg';

  if (!lesson && !sub) {
    return (
      <div
        onClick={onClick}
        className={`${roundedClass} flex-1 h-full bg-gray-100 hover:bg-amber-50 cursor-pointer transition flex items-center justify-center`}
      >
        <span className="text-gray-300 text-xs">+</span>
      </div>
    );
  }

  if (sub) {
    return (
      <div
        onClick={onClick}
        className={`${roundedClass} flex-1 px-2 py-1.5 h-full text-xs leading-tight bg-amber-50 border border-amber-200 hover:border-amber-400 cursor-pointer transition`}
      >
        <div className="text-[10px] font-medium text-amber-600 mb-0.5">
          {lesson?.group_name ?? sub.group_name ?? 'ЗАМЕНА'}
        </div>
        <div className="font-medium text-amber-900 truncate">{sub.subject_name}</div>
        {viewMode !== 'teacher' && sub.teacher_name && (
          <div className="text-amber-700 truncate">{sub.teacher_name}</div>
        )}
        {viewMode !== 'room' && sub.room_name && (
          <div className="text-amber-600 truncate">каб. {sub.room_name}</div>
        )}
      </div>
    );
  }

  // Regular lesson, no sub
  return (
    <div
      onClick={onClick}
      className={`${roundedClass} flex-1 px-2 py-1.5 h-full text-xs leading-tight bg-white border border-gray-100 hover:border-amber-300 shadow-sm cursor-pointer transition`}
    >
      {lesson!.group_name && (
        <div className="text-[10px] font-medium text-blue-500 truncate mb-0.5">{lesson!.group_name}</div>
      )}
      <div className="font-medium text-gray-900 truncate">{lesson!.subject_name}</div>
      {viewMode !== 'teacher' && lesson!.teacher_name && (
        <div className="text-gray-500 truncate">{lesson!.teacher_name}</div>
      )}
      {viewMode !== 'room' && lesson!.room_name && (
        <div className="text-gray-400 truncate">каб. {lesson!.room_name}</div>
      )}
    </div>
  );
}
