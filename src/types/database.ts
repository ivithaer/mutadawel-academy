export type UserRole = "super_admin" | "student";
export type ProfileStatus = "active" | "disabled";
export type AccessStatus = "authorized" | "revoked";
export type ContentStatus = "active" | "archived";
export type EnrollmentStatus = "active" | "revoked";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  role: UserRole;
  avatar_url: string | null;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface StudentAccess {
  id: string;
  email: string;
  status: AccessStatus;
  authorized_at: string;
  authorized_by: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  thumbnail_url: string | null;
  status: ContentStatus;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface CourseSection {
  id: string;
  course_id: string;
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  section_id: string;
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
  video_provider: string;
  video_reference: string | null;
  video_url: string | null;
  duration_seconds: number;
  order_index: number;
  status: ContentStatus;
  is_preview: boolean;
  created_at: string;
  updated_at: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  status: EnrollmentStatus;
  assigned_at: string;
  assigned_by: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonProgress {
  id: string;
  student_id: string;
  lesson_id: string;
  progress_seconds: number;
  completion_percentage: number;
  completed: boolean;
  last_watched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CourseProgress {
  id: string;
  student_id: string;
  course_id: string;
  completed_lessons: number;
  total_lessons: number;
  completion_percentage: number;
  last_lesson_id: string | null;
  updated_at: string;
}

export interface WatchSession {
  id: string;
  student_id: string;
  lesson_id: string;
  started_at: string;
  ended_at: string | null;
  watched_seconds: number;
  last_position_seconds: number;
  session_metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PlatformSetting {
  id: string;
  key: string;
  value: unknown;
  updated_at: string;
}
