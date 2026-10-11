import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useStudentAccess, useProfiles, useEnrollments, useCourses } from "@/hooks/useAdminData";
import type { StudentAccess, Profile, Course } from "@/types/database";
import {
  UserPlus,
  Ban,
  CheckCircle2,
  Mail,
  X,
  Loader2,
  Search,
  BookOpen,
  Trash2,
} from "lucide-react";

interface StudentsManagerProps {
  onError: (msg: string) => void;
}

export function StudentsManager({ onError }: StudentsManagerProps) {
  const { records: accessRecords, loading: accessLoading, refresh: refreshAccess } = useStudentAccess();
  const { records: profiles, refresh: refreshProfiles } = useProfiles();
  const { records: enrollments, refresh: refreshEnrollments } = useEnrollments();
  const { records: courses } = useCourses();

  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [assignModal, setAssignModal] = useState<Profile | null>(null);

  const profileByEmail = (email: string) => profiles.find((p) => p.email === email);

  const filtered = accessRecords.filter((r) =>
    r.email.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdd() {
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      const expiry = newExpiry ? new Date(newExpiry).toISOString() : null;
      const { error } = await supabase.rpc("admin_create_student", {
        p_email: newEmail.trim().toLowerCase(),
        p_display_name: newName.trim() || null,
        p_expires_at: expiry,
      });
      if (error) throw error;
      await refreshAccess();
      await refreshEnrollments();
      setNewEmail("");
      setNewName("");
      setNewExpiry("");
      setShowAdd(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to add student");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleStatus(record: StudentAccess) {
    const newStatus = record.status === "authorized" ? "revoked" : "authorized";
    try {
      const { error } = await supabase.rpc("admin_update_student_status", {
        p_email: record.email,
        p_status: newStatus,
      });
      if (error) throw error;
      await refreshAccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function handleDeleteAccess(record: StudentAccess) {
    try {
      const { error } = await supabase
        .from("student_access")
        .delete()
        .eq("id", record.id);
      if (error) throw error;
      await refreshAccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to delete record");
    }
  }

  async function handleRevokeEnrollment(enrollmentId: string) {
    try {
      const { error } = await supabase.rpc("admin_revoke_enrollment", {
        p_enrollment_id: enrollmentId,
      });
      if (error) throw error;
      await refreshEnrollments();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to revoke enrollment");
    }
  }

  async function handleAssignCourse(studentId: string, courseId: string, expiry: string | null) {
    try {
      const { error } = await supabase.rpc("admin_assign_course", {
        p_student_id: studentId,
        p_course_id: courseId,
        p_expires_at: expiry,
      });
      if (error) throw error;
      await refreshEnrollments();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to assign course");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Student Management</h2>
          <p className="text-sm text-gray-400 mt-1">
            Authorize emails for magic link login, manage access, and assign courses.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0C969C] text-white text-sm font-medium hover:bg-[#0a8085] transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add Student
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#0C969C] transition-colors"
        />
      </div>

      {accessLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#0C969C] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Mail className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No authorized students yet. Click "Add Student" to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => {
            const profile = profileByEmail(record.email);
            const studentEnrollments = profile
              ? enrollments.filter((e) => e.student_id === profile.id && e.status === "active")
              : [];
            return (
              <div
                key={record.id}
                className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium truncate">{record.email}</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          record.status === "authorized"
                            ? "bg-green-500/10 text-green-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {record.status === "authorized" ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Ban className="w-3 h-3" />
                        )}
                        {record.status}
                      </span>
                      {record.expires_at && (
                        <span className="text-xs text-gray-500">
                          expires {new Date(record.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {profile && (
                      <div className="mt-1 text-sm text-gray-400">
                        {profile.display_name} · {profile.role} · {profile.status}
                      </div>
                    )}
                    {studentEnrollments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {studentEnrollments.map((enr) => {
                          const course = courses.find((c) => c.id === enr.course_id);
                          return (
                            <span
                              key={enr.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#0C969C]/10 text-[#0C969C] text-xs"
                            >
                              <BookOpen className="w-3 h-3" />
                              {course?.title_en || course?.title_ar || "Course"}
                              <button
                                onClick={() => handleRevokeEnrollment(enr.id)}
                                className="hover:text-red-400 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {profile && (
                      <button
                        onClick={() => setAssignModal(profile)}
                        className="px-3 py-1.5 rounded-lg bg-gray-700 text-gray-300 text-xs hover:bg-gray-600 transition-colors flex items-center gap-1.5"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Assign Course
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleStatus(record)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        record.status === "authorized"
                          ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                      }`}
                    >
                      {record.status === "authorized" ? "Revoke" : "Authorize"}
                    </button>
                    <button
                      onClick={() => handleDeleteAccess(record)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddStudentModal
          email={newEmail}
          name={newName}
          expiry={newExpiry}
          onEmailChange={setNewEmail}
          onNameChange={setNewName}
          onExpiryChange={setNewExpiry}
          onAdd={handleAdd}
          onClose={() => setShowAdd(false)}
          adding={adding}
        />
      )}

      {assignModal && (
        <AssignCourseModal
          student={assignModal}
          courses={courses}
          existingEnrollments={enrollments.filter((e) => e.student_id === assignModal.id)}
          onAssign={handleAssignCourse}
          onClose={() => setAssignModal(null)}
        />
      )}
    </div>
  );
}

interface AddStudentModalProps {
  email: string;
  name: string;
  expiry: string;
  onEmailChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onExpiryChange: (v: string) => void;
  onAdd: () => void;
  onClose: () => void;
  adding: boolean;
}

function AddStudentModal({
  email,
  name,
  expiry,
  onEmailChange,
  onNameChange,
  onExpiryChange,
  onAdd,
  onClose,
  adding,
}: AddStudentModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Add Authorized Student</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="student@example.com"
              className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Display Name (optional)</label>
            <input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Student Name"
              className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Access Expiry (optional)</label>
            <input
              type="date"
              value={expiry}
              onChange={(e) => onExpiryChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors"
            />
          </div>
          <button
            onClick={onAdd}
            disabled={adding || !email.trim()}
            className="w-full py-2.5 rounded-lg bg-[#0C969C] text-white font-medium text-sm hover:bg-[#0a8085] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Authorize Student
          </button>
        </div>
      </div>
    </div>
  );
}

interface AssignCourseModalProps {
  student: Profile;
  courses: Course[];
  existingEnrollments: { course_id: string; status: string }[];
  onAssign: (studentId: string, courseId: string, expiry: string | null) => void;
  onClose: () => void;
}

function AssignCourseModal({ student, courses, existingEnrollments, onAssign, onClose }: AssignCourseModalProps) {
  const [selectedCourse, setSelectedCourse] = useState("");
  const [expiry, setExpiry] = useState("");

  const enrolledCourseIds = new Set(
    existingEnrollments.filter((e) => e.status === "active").map((e) => e.course_id)
  );
  const availableCourses = courses.filter((c) => !enrolledCourseIds.has(c.id) && c.status === "active");

  function handleAssign() {
    if (!selectedCourse) return;
    onAssign(student.id, selectedCourse, expiry ? new Date(expiry).toISOString() : null);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-white">Assign Course</h3>
            <p className="text-sm text-gray-400 mt-0.5">To {student.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        {availableCourses.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            No available courses to assign. All active courses are already assigned.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Course</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors"
              >
                <option value="">Select a course...</option>
                {availableCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title_en || c.title_ar}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Enrollment Expiry (optional)</label>
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white text-sm focus:outline-none focus:border-[#0C969C] transition-colors"
              />
            </div>
            <button
              onClick={handleAssign}
              disabled={!selectedCourse}
              className="w-full py-2.5 rounded-lg bg-[#0C969C] text-white font-medium text-sm hover:bg-[#0a8085] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Assign Course
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
