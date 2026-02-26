
import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === STUDENTS ===
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  nim: text("nim").notNull().unique(),
  fullName: text("full_name"),
  className: text("class_name"),
  course: text("course"), // The course selected by student during biodata
  isAdmin: boolean("is_admin").default(false),
  role: text("role").notNull().default("student"), // student, admin, pengawas
  password: text("password"), // Only for admin and pengawas
  createdBy: integer("created_by"), // Track who created this user
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStudentSchema = createInsertSchema(students).omit({ 
  id: true, 
  createdAt: true 
});

// === QUESTIONS ===
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  type: text("type").notNull().default("multiple_choice"), // multiple_choice, true_false, matching, short_answer, essay, ordering
  options: jsonb("options").$type<string[]>().notNull(), // Array of answer options (for ordering, it's the correct sequence)
  correctIndex: integer("correct_index").notNull(), // 0-based index of correct answer (ignored for essay, first item for ordering)
  correctText: text("correct_text"), // For short answer or reference for essay
  points: integer("points").notNull().default(10),
  courseName: text("course_name"), // To associate question with a specific course/subject
});

export const insertQuestionSchema = createInsertSchema(questions).omit({ id: true });

// === EXAM SESSIONS/SUBMISSIONS ===
export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  score: integer("score"),
  answers: jsonb("answers").$type<Record<string, any>>(), // Map of questionId -> selectedIndex or answer text/array
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  isCompleted: boolean("is_completed").default(false),
  isArchived: boolean("is_archived").default(false), // To track archived attempts
  archivedAt: timestamp("archived_at"),
});

// === SETTINGS ===
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  examDuration: integer("exam_duration").notNull().default(60), // minutes
  examTitle: text("exam_title").notNull().default("Ujian Akhir Semester"),
  instructions: text("instructions").notNull().default("Mohon baca instruksi di bawah ini dengan seksama sebelum memulai sesi ujian Anda."),
  antiCheatingNote: text("anti_cheating_note").notNull().default("Dilarang membuka tab lain atau aplikasi lain selama ujian berlangsung."),
  storageNote: text("storage_note").notNull().default("Jawaban akan tersimpan otomatis setiap Anda berpindah soal."),
  passingScore: integer("passing_score").notNull().default(70),
  availableClasses: text("available_classes").array().notNull().default(["Pendidikan Informatika 1 A", "Pendidikan Informatika 1 B"]),
  availableCourses: text("available_courses").array().notNull().default(["Etika Profesi", "Sistem Jaringan", "Pemrograman Dasar"]),
  activeCourses: text("active_courses").array().notNull().default(["Etika Profesi"]),
  courseDurations: jsonb("course_durations").$type<Record<string, number>>().notNull().default({}),
  appLogo: text("app_logo"),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true });

// === TYPES ===
export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;

export type Submission = typeof submissions.$inferSelect;

// Request Types
export type LoginRequest = { nim: string; password?: string };
export type UpdateBiodataRequest = { fullName: string; className: string };
export type SubmitExamRequest = { answers: Record<string, any> };

// Response Types
export type QuestionPublic = Omit<Question, "correctIndex">; 
export type LoginResponse = { student: Student; hasBiodata: boolean; isAdmin: boolean };
