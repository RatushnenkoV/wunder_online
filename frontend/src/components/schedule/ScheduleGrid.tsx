import type { ScheduleLesson } from '../../types';

const WEEKDAYS = [
  { num: 1, short: 'Пн', full: 'Понедельник' },
  { num: 2, short: 'Вт', full: 'Вторник' },
  { num: 3, short: 'Ср', full: 'Среда' },
  { num: 4, short: 'Чт', full: 'Четверг' },
  { num: 5, short: 'Пт', full: 'Пятница' },
];

const LESSON_NUMBERS = [1, 2, 3, 4, 5, 6, 7];

interface Props {
  lessons: ScheduleLesson[];
  viewMode: 'class' | 'teacher' | 'room';
  editing: boolean;
  onCellClick: (weekday: number, lessonNumber: number) => void;
  displayMode: 'week' | 'day';
  selectedDay: number;
}

export default function ScheduleGrid({ lessons, viewMode, editing, onCellClick, displayMode, selectedDay }: Props) {
  const getLessons = (weekday: number, lessonNumber: number) =>
    lessons.filter(l => l.weekday === weekday && l.lesson_number === lessonNumber);

  const renderCell = (weekday: number, lessonNumber: number) => {
    const cellLessons = getLessons(weekday, lessonNumber);
    if (cellLessons.length === 0) {
      return editing ? (
        <span className="text-gray-300 text-xs">+</span>
      ) : null;
    }

    return cellLessons.map(lesson => (
      <div key={lesson.id} className="text-xs leading-tight">
        <div className="font-medium text-gray-900">{lesson.subject_name}</div>
        {viewMode !== 'class' && (
          <div className="text-gray-500">{lesson.class_name}</div>
        )}
        {viewMode !== 'teacher' && lesson.teacher_name && (
          <div className="text-gray-500">{lesson.teacher_name}</div>
        )}
        {viewMode !== 'room' && lesson.room_name && (
          <div className="text-gray-400">каб. {lesson.room_name}</div>
        )}
      </div>
    ));
  };

  const visibleDays = displayMode === 'day'
    ? WEEKDAYS.filter(d => d.num === selectedDay)
    : WEEKDAYS;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 w-12">#</th>
            {visibleDays.map(d => (
              <th key={d.num} className="border bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600">
                {displayMode === 'day' ? d.full : d.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LESSON_NUMBERS.map(num => (
            <tr key={num}>
              <td className="border bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 text-center">
                {num}
              </td>
              {visibleDays.map(d => {
                const hasContent = getLessons(d.num, num).length > 0;
                return (
                  <td
                    key={d.num}
                    onClick={() => onCellClick(d.num, num)}
                    className={`border px-3 py-2 align-top ${displayMode === 'day' ? '' : 'min-w-[140px]'} h-[70px] ${
                      editing ? 'cursor-pointer hover:bg-blue-50' : ''
                    } ${hasContent ? 'bg-white' : 'bg-gray-50/50'}`}
                  >
                    {renderCell(d.num, num)}
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
