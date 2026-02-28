export interface ParentChild {
  id: number;              // user id студента
  student_profile_id: number;
  first_name: string;
  last_name: string;
  school_class_name: string;
}

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  birth_date?: string | null;
  is_admin: boolean;
  is_teacher: boolean;
  is_parent: boolean;
  is_student: boolean;
  must_change_password: boolean;
  temp_password: string;
  roles: string[];
  curated_classes?: string[];
  children?: ParentChild[];  // только для родителей (из /auth/me/)
}

export interface Parent {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  telegram: string;
  birth_date: string | null;
  must_change_password: boolean;
  temp_password: string;
  roles: string[];
  curated_classes: string[];
  children: ParentChild[];
}

export interface GradeLevel {
  id: number;
  number: number;
  subjects: Subject[];
}

export interface SchoolClass {
  id: number;
  grade_level: number;
  grade_level_number: number;
  letter: string;
  display_name: string;
  students_count: number;
  curator_id?: number | null;
  curator_name?: string | null;
}

export interface Subject {
  id: number;
  name: string;
}

export interface GradeLevelSubject {
  id: number;
  grade_level: number;
  grade_level_number: number;
  subject: number;
  subject_name: string;
}

export interface StudentProfile {
  id: number;
  user: User;
  school_class: number;
  school_class_name: string;
}

export interface CTP {
  id: number;
  teacher: number;
  teacher_name: string;
  school_class: number;
  class_name: string;
  subject: number;
  subject_name: string;
  is_public: boolean;
  topics_count: number;
  created_at: string;
  updated_at: string;
}

export interface CTPDetail extends CTP {
  topics: Topic[];
}

export interface TopicFile {
  id: number;
  topic: number;
  file: string;
  original_name: string;
  uploaded_at: string;
}

export interface Topic {
  id: number;
  ctp: number;
  order: number;
  title: string;
  date: string | null;
  homework: string;
  resources: Resource[];
  files: TopicFile[];
  created_at: string;
}

export interface TopicByDate {
  id: number;
  title: string;
  date: string | null;
  homework: string;
  resources: Resource[];
  files: TopicFile[];
  subject_name: string;
  ctp_id: number;
  class_id: number;
  class_name: string;
  ctp_teacher_id: number;
}

export interface Resource {
  title: string;
  url: string;
}

export interface Holiday {
  id: number;
  date: string;
  description: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface ClassGroup {
  id: number;
  school_class: number;
  name: string;
  students: number[];
  students_detail: { id: number; first_name: string; last_name: string }[];
}

export interface ClassSubject {
  id: number;
  school_class: number;
  name: string;
}

export interface TeacherOption {
  id: number;
  first_name: string;
  last_name: string;
}

export interface Room {
  id: number;
  name: string;
}

export interface Substitution {
  id: number;
  date: string; // YYYY-MM-DD
  lesson_number: number;
  school_class: number;
  class_name: string;
  subject: number;
  subject_name: string;
  teacher: number | null;
  teacher_name: string | null;
  room: number | null;
  room_name: string | null;
  original_lesson: number | null;
  group: number | null;
  group_name: string | null;
  original_subject_name: string | null;
  original_teacher_name: string | null;
  original_room_name: string | null;
  original_class_name: string | null;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export type TaskStatus = 'new' | 'in_progress' | 'review' | 'done';

export interface TaskMember {
  id: number;
  first_name: string;
  last_name: string;
  roles: string[];
}

export interface TaskGroup {
  id: number;
  name: string;
  description: string;
  created_by: number;
  created_by_name: string;
  members: number[];
  members_detail: TaskMember[];
  is_member: boolean;
  created_at: string;
}

export interface TaskFile {
  id: number;
  original_name: string;
  url: string;
  uploaded_by: number;
  uploaded_by_name: string;
  uploaded_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  created_by: number;
  created_by_name: string;
  assigned_to: number | null;
  assigned_to_name: string | null;
  assigned_group: number | null;
  assigned_group_name: string | null;
  taken_by: number | null;
  taken_by_name: string | null;
  status: TaskStatus;
  due_date: string | null;
  is_assignee: boolean;
  can_reassign: boolean;
  review_comment: string;
  files: TaskFile[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TasksCount {
  new: number;
  review: number;
  total: number;
}

// ─── Form answers / results ───────────────────────────────────────────────────

export interface FormAnswerValue {
  question_id: string;
  value: number | number[] | string | null;
}

export interface FormQuestionStat {
  question_id: string;
  type: FormQuestionType;
  text: string;
  answer_count: number;
  has_correct: boolean;
  // single / multiple
  options?: string[];
  option_counts?: number[];
  correct_count?: number;
  // text
  text_answers?: { student_id: number; student_name: string; value: string; is_correct: boolean | null }[];
  // scale
  avg?: number | null;
  value_counts?: Record<string, number>;
}

export interface FormStudentDetail {
  student_id: number;
  student_name: string;
  answers: { question_id: string; value: unknown; is_correct: boolean | null }[];
  correct_count: number;
  total_with_correct: number;
}

export interface FormResults {
  summary: {
    answered_count: number;
    total_questions: number;
    total_correct: number;
    total_with_correct: number;
    per_question: FormQuestionStat[];
  };
  details: FormStudentDetail[];
}

// ─── Lessons ─────────────────────────────────────────────────────────────────

export interface LessonFolder {
  id: number;
  name: string;
  owner: number;
  owner_name: string;
  parent: number | null;
  children_count: number;
  lessons_count: number;
  created_at: string;
}

export interface Lesson {
  id: number;
  title: string;
  description: string;
  owner: number;
  owner_name: string;
  folder: number | null;
  folder_name: string | null;
  is_public: boolean;
  cover_color: string;
  is_owner: boolean;
  slides_count: number;
  created_at: string;
  updated_at: string;
}

export interface LessonSession {
  id: number;
  lesson: number;
  lesson_title: string;
  teacher: number;
  teacher_name: string;
  school_class: number | null;
  school_class_name: string;
  current_slide_id: number | null;
  is_active: boolean;
  started_at: string;
  ended_at: string | null;
}

export type SlideType = 'content' | 'image' | 'poll' | 'quiz' | 'open_question' | 'video' | 'form' | 'discussion' | 'vocab';

export type FormQuestionType = 'single' | 'multiple' | 'text' | 'scale';

export interface FormQuestion {
  id: string;
  type: FormQuestionType;
  text: string;
  required: boolean;
  options?: string[];
  scale_min?: number;
  scale_max?: number;
  scale_min_label?: string;
  scale_max_label?: string;
  // Правильные ответы (опционально — если не указаны, учитель проверяет вручную)
  correct_options?: number[];  // индексы правильных вариантов (single/multiple)
  correct_text?: string;       // для type='text'
  correct_scale?: number;      // для type='scale'
}

export interface VideoContent {
  url: string;
  embed_url: string;
  caption: string;
}

export interface DiscussionSticker {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  author_id: number;
  author_name: string;
  created_at: string;
}

export interface DiscussionArrow {
  id: string;
  from_id: string;
  to_id: string;
  author_id: number;
  author_name: string;
}

// ─── Vocab slide ─────────────────────────────────────────────────────────────

export interface VocabWord {
  id: string;
  ru: string;
  target: string;
  imageUrl?: string;  // Pixabay (stub for now)
}

export interface VocabTasks {
  ruToTargetChoice: boolean;
  ruToTargetInput: boolean;
  targetToRuChoice: boolean;
  targetToRuInput: boolean;
  audioToTargetChoice: boolean;
  audioToTargetInput: boolean;
  imageToTargetChoice: boolean;
  imageToTargetInput: boolean;
}

export interface VocabContent {
  targetLang: 'en' | 'kk';
  words: VocabWord[];
  tasks: VocabTasks;
  repetitions: number | 'until_correct';
}

export interface VocabProgressRecord {
  student_id: number;
  student_name: string;
  word_id: string;
  attempts: number;
  correct: number;
  learned: boolean;
  updated_at: string;
}

export interface DiscussionStroke {
  id: string;
  points: [number, number][];
  color: string;
  width: number;
}

export type ShapeType = 'rect' | 'circle' | 'triangle' | 'diamond' | 'star' | 'line';

export interface SlideBlock {
  id: string;           // 'b<timestamp>_<random>'
  type: 'text' | 'image' | 'shape';
  x: number;            // может быть за пределами 0..960
  y: number;            // может быть за пределами 0..540
  w: number;
  h: number;
  zIndex: number;
  rotation?: number;    // градусы, 0 по умолчанию
  html?: string;        // для text
  src?: string;         // для image: URL
  alt?: string;
  shape?: ShapeType;    // для shape
  fillColor?: string;   // hex или 'transparent'
  strokeColor?: string; // hex или 'transparent'
  strokeWidth?: number; // толщина границы в px
}

export interface SlideContent {
  blocks: SlideBlock[];
}

export interface Slide {
  id: number;
  lesson: number;
  order: number;
  slide_type: SlideType;
  title: string;
  // content varies by slide_type: SlideContent | {questions} | VideoContent | {stickers,strokes}
  content: SlideContent & Record<string, unknown>;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface FolderContents {
  folder: LessonFolder;
  subfolders: LessonFolder[];
  lessons: Lesson[];
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatUser {
  id: number;
  first_name: string;
  last_name: string;
  display_name: string;
  is_admin: boolean;
  is_teacher: boolean;
  is_student: boolean;
  is_parent: boolean;
}

export interface ChatAttachment {
  id: number;
  original_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
}

export interface ChatReplyPreview {
  id: number;
  text: string;
  sender_name: string;
}

export interface ChatPollOption {
  id: number;
  text: string;
  order: number;
  vote_count: number;
  user_voted: boolean;
  voters: { id: number; name: string }[];
}

export interface ChatPoll {
  id: number;
  question: string;
  is_multiple: boolean;
  options: ChatPollOption[];
  total_votes: number;
}

export interface ChatTaskPreview {
  id: number;
  title: string;
  description: string;
  due_date: string | null;
  created_by_name: string;
  takers: { id: number; name: string }[];
  user_took: boolean;
}

export interface ChatMessage {
  id: number;
  room: number;
  sender: ChatUser | null;
  text: string;
  reply_to: number | null;
  reply_to_preview: ChatReplyPreview | null;
  attachments: ChatAttachment[];
  poll: ChatPoll | null;
  task_preview: ChatTaskPreview | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface ChatLastMessage {
  id: number;
  text: string;
  sender_id: number | null;
  sender_name: string;
  created_at: string;
}

export interface ChatOtherUser {
  id: number;
  first_name: string;
  last_name: string;
  display_name: string;
  is_admin: boolean;
  is_teacher: boolean;
  is_student: boolean;
}

export interface ChatMember {
  id: number;
  user: ChatUser;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface ChatRoom {
  id: number;
  room_type: 'group' | 'direct';
  name: string;
  created_by: number | null;
  is_archived: boolean;
  created_at: string;
  last_message: ChatLastMessage | null;
  unread_count: number;
  other_user: ChatOtherUser | null;
  members_count: number;
}

export interface ChatRoomDetail extends ChatRoom {
  members: ChatMember[];
}

// ─── ScheduleLesson ───────────────────────────────────────────────────────────

export interface ScheduleLesson {
  id: number;
  school_class: number;
  class_name: string;
  weekday: number;
  lesson_number: number;
  subject: number;
  subject_name: string;
  teacher: number | null;
  teacher_name: string | null;
  room: number | null;
  room_name: string | null;
  group: number | null;
  group_name: string | null;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface ProjectUser {
  id: number;
  first_name: string;
  last_name: string;
  display_name: string;
  is_admin: boolean;
  is_teacher: boolean;
  is_student: boolean;
}

export interface ProjectMember {
  id: number;
  user: ProjectUser;
  role: 'teacher' | 'student';
  joined_at: string;
}

export interface PostAttachment {
  id: number;
  original_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
}

export interface ProjectPost {
  id: number;
  project: number;
  author: ProjectUser | null;
  text: string;
  attachments: PostAttachment[];
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssignmentAttachment {
  id: number;
  original_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
}

export interface SubmissionFile {
  id: number;
  original_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
}

export interface AssignmentSubmission {
  id: number;
  assignment: number;
  student: ProjectUser;
  text: string;
  files: SubmissionFile[];
  submitted_at: string;
  grade: string | null;
  graded_by: ProjectUser | null;
  graded_at: string | null;
  task_id: number | null;
  task_status: TaskStatus | null;
  review_comment: string;
}

export interface ProjectAssignment {
  id: number;
  project: number;
  title: string;
  description: string;
  due_date: string | null;
  created_by: ProjectUser | null;
  attachments: AssignmentAttachment[];
  submissions_count: number;
  my_submission: AssignmentSubmission | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  cover_color: string;
  created_by: ProjectUser | null;
  members_count: number;
  my_role: 'teacher' | 'student' | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail extends Project {
  members: ProjectMember[];
}
