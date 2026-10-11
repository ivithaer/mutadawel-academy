import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCourses, useSections, useLessons } from "@/hooks/useAdminData";
import type { Course, CourseSection, Lesson, ContentStatus } from "@/types/database";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Layers,
  PlayCircle,
  Archive,
  CheckCircle2,
  Save,
} from "lucide-react";

interface CoursesManagerProps {
  onError: (msg: string) => void;
}

export function CoursesManager({ onError }: CoursesManagerProps) {
  const { records: courses, loading, refresh: refreshCourses } = useCourses();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [showCourseForm, setShowCourseForm] = useState(false);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) ?? null;

  async function handleSaveCourse(data: Partial<Course>, id?: string) {
    try {
      if (id) {
        const { error } = await supabase.from("courses").update(data).eq("id", id);
        if (error) throw error;
      } else {
        const maxOrder = courses.length > 0 ? Math.max(...courses.map((c) => c.order_index)) : 0;
        const { error } = await supabase.from("courses").insert({
          ...data,
          order_index: maxOrder + 1,
        });
        if (error) throw error;
      }
      await refreshCourses();
      setShowCourseForm(false);
      setEditingCourse(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save course");
    }
  }

  async function handleDeleteCourse(course: Course) {
    if (!confirm(`Delete "${course.title_en || course.title_ar}"? This removes all sections and lessons.`)) return;
    try {
      const { error } = await supabase.from("courses").delete().eq("id", course.id);
      if (error) throw error;
      if (selectedCourseId === course.id) setSelectedCourseId(null);
      await refreshCourses();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to delete course");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 text-[#0C969C] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Course Management</h2>
          <p className="text-sm text-gray-400 mt-1">
            Create courses, add sections and lessons, and configure video URLs.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingCourse(null);
            setShowCourseForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0C969C] text-white text-sm font-medium hover:bg-[#0a8085] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Course
        </button>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No courses yet. Click "New Course" to create one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {courses.map((course) => (
            <CourseRow
              key={course.id}
              course={course}
              isSelected={selectedCourseId === course.id}
              onToggle={() =>
                setSelectedCourseId(selectedCourseId === course.id ? null : course.id)
              }
              onEdit={() => {
                setEditingCourse(course);
                setShowCourseForm(true);
              }}
              onDelete={() => handleDeleteCourse(course)}
            />
          ))}
        </div>
      )}

      {selectedCourse && <SectionsPanel courseId={selectedCourse.id} onError={onError} />}

      {showCourseForm && (
        <CourseFormModal
          course={editingCourse}
          onSave={(data) => handleSaveCourse(data, editingCourse?.id)}
          onClose={() => {
            setShowCourseForm(false);
            setEditingCourse(null);
          }}
        />
      )}
    </div>
  );
}

function CourseRow({
  course,
  isSelected,
  onToggle,
  onEdit,
  onDelete,
}: {
  course: Course;
  isSelected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`bg-gray-800/50 border rounded-xl transition-colors ${
        isSelected ? "border-[#0C969C]" : "border-gray-700/50 hover:border-gray-600"
      }`}
    >
      <div className="flex items-center justify-between p-4">
        <button onClick={onToggle} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          {isSelected ? (
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium truncate">
                {course.title_en || course.title_ar || "Untitled Course"}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                  course.status === "active"
                    ? "bg-green-500/10 text-green-400"
                    : "bg-gray-600/20 text-gray-400"
                }`}
              >
                {course.status === "active" ? <CheckCircle2 className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                {course.status}
              </span>
            </div>
            <span className="text-sm text-gray-500 truncate block">
              {course.title_ar || "—"}
            </span>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CourseFormModal({
  course,
  onSave,
  onClose,
}: {
  course: Course | null;
  onSave: (data: Partial<Course>) => void;
  onClose: () => void;
}) {
  const [titleEn, setTitleEn] = useState(course?.title_en ?? "");
  const [titleAr, setTitleAr] = useState(course?.title_ar ?? "");
  const [descEn, setDescEn] = useState(course?.description_en ?? "");
  const [descAr, setDescAr] = useState(course?.description_ar ?? "");
  const [status, setStatus] = useState<ContentStatus>(course?.status ?? "active");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">
            {course ? "Edit Course" : "New Course"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Title (English)</label>
              <input
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Title (Arabic)</label>
              <input
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                dir="rtl"
                className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Description (English)</label>
              <textarea
                value={descEn}
                onChange={(e) => setDescEn(e.target.value)}
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors resize-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Description (Arabic)</label>
              <textarea
                value={descAr}
                onChange={(e) => setDescAr(e.target.value)}
                dir="rtl"
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors resize-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ContentStatus)}
              className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <button
            onClick={() =>
              onSave({
                title_en: titleEn,
                title_ar: titleAr,
                description_en: descEn,
                description_ar: descAr,
                status,
              })
            }
            className="w-full py-2.5 rounded-lg bg-[#0C969C] text-white font-medium text-sm hover:bg-[#0a8085] transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Course
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionsPanel({ courseId, onError }: { courseId: string; onError: (msg: string) => void }) {
  const { records: sections, loading, refresh } = useSections(courseId);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<CourseSection | null>(null);
  const [showSectionForm, setShowSectionForm] = useState(false);

  async function handleSaveSection(data: Partial<CourseSection>, id?: string) {
    try {
      if (id) {
        const { error } = await supabase.from("course_sections").update(data).eq("id", id);
        if (error) throw error;
      } else {
        const maxOrder = sections.length > 0 ? Math.max(...sections.map((s) => s.order_index)) : 0;
        const { error } = await supabase.from("course_sections").insert({
          ...data,
          course_id: courseId,
          order_index: maxOrder + 1,
        });
        if (error) throw error;
      }
      await refresh();
      setShowSectionForm(false);
      setEditingSection(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save section");
    }
  }

  async function handleDeleteSection(section: CourseSection) {
    if (!confirm(`Delete section "${section.title_en || section.title_ar}"? This removes all lessons.`)) return;
    try {
      const { error } = await supabase.from("course_sections").delete().eq("id", section.id);
      if (error) throw error;
      if (expandedSection === section.id) setExpandedSection(null);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to delete section");
    }
  }

  if (loading) return null;

  return (
    <div className="mt-4 ml-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Layers className="w-4 h-4" />
          Sections
        </h3>
        <button
          onClick={() => {
            setEditingSection(null);
            setShowSectionForm(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 text-xs hover:bg-gray-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Section
        </button>
      </div>

      {sections.length === 0 ? (
        <p className="text-sm text-gray-500 py-3">No sections yet.</p>
      ) : (
        <div className="space-y-2">
          {sections.map((section) => (
            <div key={section.id} className="bg-gray-900/50 border border-gray-700/30 rounded-lg">
              <div className="flex items-center justify-between p-3">
                <button
                  onClick={() =>
                    setExpandedSection(expandedSection === section.id ? null : section.id)
                  }
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  {expandedSection === section.id ? (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  )}
                  <span className="text-sm text-white truncate">
                    {section.title_en || section.title_ar || "Untitled Section"}
                  </span>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      setEditingSection(section);
                      setShowSectionForm(true);
                    }}
                    className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSection(section)}
                    className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {expandedSection === section.id && (
                <LessonsPanel sectionId={section.id} onError={onError} />
              )}
            </div>
          ))}
        </div>
      )}

      {showSectionForm && (
        <SectionFormModal
          section={editingSection}
          onSave={(data) => handleSaveSection(data, editingSection?.id)}
          onClose={() => {
            setShowSectionForm(false);
            setEditingSection(null);
          }}
        />
      )}
    </div>
  );
}

function SectionFormModal({
  section,
  onSave,
  onClose,
}: {
  section: CourseSection | null;
  onSave: (data: Partial<CourseSection>) => void;
  onClose: () => void;
}) {
  const [titleEn, setTitleEn] = useState(section?.title_en ?? "");
  const [titleAr, setTitleAr] = useState(section?.title_ar ?? "");
  const [descEn, setDescEn] = useState(section?.description_en ?? "");
  const [descAr, setDescAr] = useState(section?.description_ar ?? "");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">
            {section ? "Edit Section" : "New Section"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Title (English)</label>
              <input
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Title (Arabic)</label>
              <input
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                dir="rtl"
                className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Description (English)</label>
              <textarea
                value={descEn}
                onChange={(e) => setDescEn(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors resize-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Description (Arabic)</label>
              <textarea
                value={descAr}
                onChange={(e) => setDescAr(e.target.value)}
                dir="rtl"
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors resize-none"
              />
            </div>
          </div>
          <button
            onClick={() =>
              onSave({
                title_en: titleEn,
                title_ar: titleAr,
                description_en: descEn,
                description_ar: descAr,
              })
            }
            className="w-full py-2.5 rounded-lg bg-[#0C969C] text-white font-medium text-sm hover:bg-[#0a8085] transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Section
          </button>
        </div>
      </div>
    </div>
  );
}

function LessonsPanel({ sectionId, onError }: { sectionId: string; onError: (msg: string) => void }) {
  const { records: lessons, loading, refresh } = useLessons(sectionId);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [showLessonForm, setShowLessonForm] = useState(false);

  async function handleSaveLesson(data: Partial<Lesson>, id?: string) {
    try {
      if (id) {
        const { error } = await supabase.from("lessons").update(data).eq("id", id);
        if (error) throw error;
      } else {
        const maxOrder = lessons.length > 0 ? Math.max(...lessons.map((l) => l.order_index)) : 0;
        const { error } = await supabase.from("lessons").insert({
          ...data,
          section_id: sectionId,
          order_index: maxOrder + 1,
        });
        if (error) throw error;
      }
      await refresh();
      setShowLessonForm(false);
      setEditingLesson(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save lesson");
    }
  }

  async function handleDeleteLesson(lesson: Lesson) {
    if (!confirm(`Delete lesson "${lesson.title_en || lesson.title_ar}"?`)) return;
    try {
      const { error } = await supabase.from("lessons").delete().eq("id", lesson.id);
      if (error) throw error;
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to delete lesson");
    }
  }

  if (loading) return null;

  return (
    <div className="px-3 pb-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
          <PlayCircle className="w-3.5 h-3.5" />
          Lessons
        </h4>
        <button
          onClick={() => {
            setEditingLesson(null);
            setShowLessonForm(true);
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-700 text-gray-300 text-xs hover:bg-gray-600 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Lesson
        </button>
      </div>

      {lessons.length === 0 ? (
        <p className="text-xs text-gray-500 py-2">No lessons yet.</p>
      ) : (
        <div className="space-y-1.5">
          {lessons.map((lesson) => (
            <div
              key={lesson.id}
              className="flex items-center justify-between p-2.5 rounded-md bg-gray-800/40 border border-gray-700/30"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <PlayCircle className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white truncate">
                      {lesson.title_en || lesson.title_ar || "Untitled Lesson"}
                    </span>
                    {lesson.is_preview && (
                      <span className="px-1.5 py-0.5 rounded text-xs bg-[#0C969C]/10 text-[#0C969C]">
                        Preview
                      </span>
                    )}
                    <span
                      className={`px-1.5 py-0.5 rounded text-xs ${
                        lesson.status === "active"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-gray-600/20 text-gray-400"
                      }`}
                    >
                      {lesson.status}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {lesson.video_provider}
                    {lesson.video_url ? " · has URL" : " · no URL"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => {
                    setEditingLesson(lesson);
                    setShowLessonForm(true);
                  }}
                  className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteLesson(lesson)}
                  className="p-1 rounded text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showLessonForm && (
        <LessonFormModal
          lesson={editingLesson}
          onSave={(data) => handleSaveLesson(data, editingLesson?.id)}
          onClose={() => {
            setShowLessonForm(false);
            setEditingLesson(null);
          }}
        />
      )}
    </div>
  );
}

function LessonFormModal({
  lesson,
  onSave,
  onClose,
}: {
  lesson: Lesson | null;
  onSave: (data: Partial<Lesson>) => void;
  onClose: () => void;
}) {
  const [titleEn, setTitleEn] = useState(lesson?.title_en ?? "");
  const [titleAr, setTitleAr] = useState(lesson?.title_ar ?? "");
  const [descEn, setDescEn] = useState(lesson?.description_en ?? "");
  const [descAr, setDescAr] = useState(lesson?.description_ar ?? "");
  const [videoProvider, setVideoProvider] = useState(lesson?.video_provider ?? "generic_embed");
  const [videoUrl, setVideoUrl] = useState(lesson?.video_url ?? "");
  const [videoRef, setVideoRef] = useState(lesson?.video_reference ?? "");
  const [duration, setDuration] = useState(lesson?.duration_seconds?.toString() ?? "0");
  const [status, setStatus] = useState<ContentStatus>(lesson?.status ?? "active");
  const [isPreview, setIsPreview] = useState(lesson?.is_preview ?? false);

  const providers = [
    { value: "generic_embed", label: "Generic Embed (URL)" },
    { value: "youtube", label: "YouTube" },
    { value: "vimeo", label: "Vimeo" },
    { value: "wistia", label: "Wistia" },
    { value: "cloudflare_stream", label: "Cloudflare Stream" },
    { value: "bunny", label: "Bunny.net" },
    { value: "s3", label: "S3 / Direct URL" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">
            {lesson ? "Edit Lesson" : "New Lesson"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Title (English)</label>
              <input
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Title (Arabic)</label>
              <input
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                dir="rtl"
                className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Description (English)</label>
              <textarea
                value={descEn}
                onChange={(e) => setDescEn(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors resize-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Description (Arabic)</label>
              <textarea
                value={descAr}
                onChange={(e) => setDescAr(e.target.value)}
                dir="rtl"
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors resize-none"
              />
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4">
            <h4 className="text-sm font-semibold text-[#0C969C] mb-3">Video Configuration</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Video Provider</label>
                <select
                  value={videoProvider}
                  onChange={(e) => setVideoProvider(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors"
                >
                  {providers.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Video URL</label>
                <input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Video Reference ID (optional)</label>
                <input
                  value={videoRef}
                  onChange={(e) => setVideoRef(e.target.value)}
                  placeholder="e.g. YouTube video ID, Vimeo ID..."
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Duration (seconds)</label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4 flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-300 mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ContentStatus)}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="flex items-end pb-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPreview}
                  onChange={(e) => setIsPreview(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#0C969C]"
                />
                <span className="text-sm text-gray-300">Free Preview</span>
              </label>
            </div>
          </div>

          <button
            onClick={() =>
              onSave({
                title_en: titleEn,
                title_ar: titleAr,
                description_en: descEn,
                description_ar: descAr,
                video_provider: videoProvider,
                video_url: videoUrl || null,
                video_reference: videoRef || null,
                duration_seconds: parseInt(duration) || 0,
                status,
                is_preview: isPreview,
              })
            }
            className="w-full py-2.5 rounded-lg bg-[#0C969C] text-white font-medium text-sm hover:bg-[#0a8085] transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Lesson
          </button>
        </div>
      </div>
    </div>
  );
}
