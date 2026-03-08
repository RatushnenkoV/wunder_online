import type { TaskStatus } from '../../types';

export const COLUMNS: {
  status: TaskStatus;
  label: string;
  colorBg: string;
  colorBorder: string;
  colorDrag: string;
}[] = [
  { status: 'new',         label: 'Поставленные', colorBg: 'bg-purple-50 dark:bg-purple-950/20',  colorBorder: 'border-purple-200 dark:border-purple-900/60',  colorDrag: 'ring-2 ring-purple-400 bg-purple-100 dark:bg-purple-900/40' },
  { status: 'in_progress', label: 'В работе',      colorBg: 'bg-amber-50 dark:bg-amber-950/20',   colorBorder: 'border-amber-200 dark:border-amber-900/60',    colorDrag: 'ring-2 ring-amber-400 bg-amber-100 dark:bg-amber-900/40' },
  { status: 'review',      label: 'На проверке',   colorBg: 'bg-purple-50 dark:bg-purple-950/20', colorBorder: 'border-purple-200 dark:border-purple-900/60',  colorDrag: 'ring-2 ring-purple-400 bg-purple-100 dark:bg-purple-900/40' },
];

export const DONE_COL = {
  status: 'done' as TaskStatus,
  label: 'Выполнено',
  colorBg: 'bg-green-50 dark:bg-green-950/20',
  colorBorder: 'border-green-200 dark:border-green-900/60',
  colorDrag: '',
};
