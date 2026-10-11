import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type {
  StudentAccess,
  Profile,
  Course,
  CourseSection,
  Lesson,
  Enrollment,
} from "@/types/database";

export function useStudentAccess() {
  const [records, setRecords] = useState<StudentAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("student_access")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setRecords((data as StudentAccess[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { records, loading, error, refresh };
}

export function useProfiles() {
  const [records, setRecords] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setRecords((data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { records, loading, error, refresh };
}

export function useCourses() {
  const [records, setRecords] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("courses")
      .select("*")
      .order("order_index", { ascending: true });
    if (error) setError(error.message);
    else setRecords((data as Course[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { records, loading, error, refresh };
}

export function useSections(courseId: string | null) {
  const [records, setRecords] = useState<CourseSection[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!courseId) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("course_sections")
      .select("*")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true });
    if (error) {
      setRecords([]);
    } else {
      setRecords((data as CourseSection[]) ?? []);
    }
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { records, loading, refresh };
}

export function useLessons(sectionId: string | null) {
  const [records, setRecords] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!sectionId) {
      setRecords([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("lessons")
      .select("*")
      .eq("section_id", sectionId)
      .order("order_index", { ascending: true });
    if (error) {
      setRecords([]);
    } else {
      setRecords((data as Lesson[]) ?? []);
    }
    setLoading(false);
  }, [sectionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { records, loading, refresh };
}

export function useEnrollments() {
  const [records, setRecords] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("enrollments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setRecords((data as Enrollment[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { records, loading, error, refresh };
}
