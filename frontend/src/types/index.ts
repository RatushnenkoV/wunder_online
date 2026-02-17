export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  is_admin: boolean;
  is_teacher: boolean;
  is_parent: boolean;
  is_student: boolean;
  must_change_password: boolean;
  temp_password: string;
  roles: string[];
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
  group: number | null;
  group_name: string | null;
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
