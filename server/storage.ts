
import { db } from "./db";
import {
  students, questions, submissions, settings,
  type InsertStudent, type Student,
  type Question, type Submission, type InsertQuestion
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // Student Auth
  getStudentByNim(nim: string): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: number, data: Partial<Student>): Promise<Student>;
  
  // Exam
  getQuestions(): Promise<Question[]>;
  createSubmission(studentId: number): Promise<Submission>;
  getSubmission(id: number): Promise<Submission | undefined>;
  completeSubmission(id: number, answers: Record<string, number>, score: number): Promise<Submission>;
  
  // Admin
  getAllSubmissions(): Promise<{ submission: Submission; student: Student }[]>;
  getAllStudents(): Promise<Student[]>;
  deleteStudent(id: number): Promise<void>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: number, data: Partial<InsertQuestion>): Promise<Question>;
  deleteQuestion(id: number): Promise<void>;
  deleteSubmission(id: number): Promise<void>;
  bulkDeleteSubmissions(filters: { className?: string; courseName?: string; minScore?: number; maxScore?: number }): Promise<void>;
  
  // Settings
  getSettings(): Promise<any>;
  updateSettings(data: any): Promise<any>;

  // Seed
  seedQuestions(): Promise<void>;
  seedAdmin(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getStudentByNim(nim: string): Promise<Student | undefined> {
    const [student] = await db.select().from(students).where(eq(students.nim, nim));
    return student;
  }

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const [student] = await db.insert(students).values(insertStudent).returning();
    return student;
  }

  async updateStudent(id: number, data: Partial<Student>): Promise<Student> {
    const [updated] = await db.update(students)
      .set(data)
      .where(eq(students.id, id))
      .returning();
    return updated;
  }

  async getQuestions(): Promise<Question[]> {
    return await db.select().from(questions);
  }

  async createSubmission(studentId: number): Promise<Submission> {
    const [existing] = await db.select().from(submissions)
      .where(and(eq(submissions.studentId, studentId), eq(submissions.isArchived, false)))
      .orderBy(desc(submissions.startTime))
      .limit(1);
    
    if (existing && !existing.isCompleted) return existing;
    if (existing && existing.isCompleted) {
      throw new Error("Anda sudah menyelesaikan ujian dan tidak dapat mengulang kembali.");
    }

    const [submission] = await db.insert(submissions)
      .values({ studentId, isCompleted: false, answers: {} })
      .returning();
    return submission;
  }

  async deleteSubmission(id: number): Promise<void> {
    // Archive instead of delete to keep history
    await db.update(submissions)
      .set({ isArchived: true, archivedAt: new Date() })
      .where(eq(submissions.id, id));
  }

  async bulkDeleteSubmissions(filters: { className?: string; courseName?: string; minScore?: number; maxScore?: number }): Promise<void> {
    const all = await this.getAllSubmissions();
    const filteredIds = all.filter(item => {
      if (filters.className && item.student.className !== filters.className) return false;
      if (filters.courseName && item.student.course !== filters.courseName) return false;
      if (filters.minScore !== undefined && (item.submission.score || 0) < filters.minScore) return false;
      if (filters.maxScore !== undefined && (item.submission.score || 0) > filters.maxScore) return false;
      return true;
    }).map(item => item.submission.id);

    if (filteredIds.length > 0) {
      for (const id of filteredIds) {
        await this.deleteSubmission(id);
      }
    }
  }

  async getSubmission(id: number): Promise<Submission | undefined> {
    const [submission] = await db.select().from(submissions).where(eq(submissions.id, id));
    return submission;
  }

  async completeSubmission(id: number, answers: Record<string, number>, score: number): Promise<Submission> {
    const [submission] = await db.update(submissions)
      .set({ 
        answers, 
        score, 
        endTime: new Date(), 
        isCompleted: true 
      })
      .where(eq(submissions.id, id))
      .returning();
    return submission;
  }

  async getAllSubmissions(): Promise<{ submission: Submission; student: Student }[]> {
    const results = await db.select({
      submission: submissions,
      student: students
    })
    .from(submissions)
    .innerJoin(students, eq(submissions.studentId, students.id))
    .where(eq(submissions.isArchived, false))
    .orderBy(desc(submissions.startTime));
    
    console.log(`Fetched ${results.length} active submissions`);
    return results;
  }

  async getArchivedSubmissions(): Promise<{ submission: Submission; student: Student }[]> {
    return await db.select({
      submission: submissions,
      student: students
    })
    .from(submissions)
    .innerJoin(students, eq(submissions.studentId, students.id))
    .where(eq(submissions.isArchived, true))
    .orderBy(desc(submissions.archivedAt));
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const insertData: any = { ...question };
    
    // Check if options is object (due to how some clients send arrays)
    if (question.options && typeof question.options === 'object' && !Array.isArray(question.options)) {
      insertData.options = Object.values(question.options);
    }

    const [newQuestion] = await db.insert(questions).values(insertData).returning();
    return newQuestion;
  }

  async updateQuestion(id: number, data: Partial<InsertQuestion>): Promise<Question> {
    const updateData: any = { ...data };
    
    // Check if options is object (due to how some clients send arrays)
    if (data.options && typeof data.options === 'object' && !Array.isArray(data.options)) {
      updateData.options = Object.values(data.options);
    }
    
    const [updated] = await db.update(questions)
      .set(updateData)
      .where(eq(questions.id, id))
      .returning();
    return updated;
  }

  async deleteQuestion(id: number): Promise<void> {
    await db.delete(questions).where(eq(questions.id, id));
  }

  async deleteArchivedSubmission(id: number): Promise<void> {
    await db.delete(submissions).where(and(eq(submissions.id, id), eq(submissions.isArchived, true)));
  }

  async clearArchive(filters: { className?: string }): Promise<void> {
    if (filters.className) {
      const archived = await this.getArchivedSubmissions();
      const ids = archived
        .filter(item => item.student.className === filters.className)
        .map(item => item.submission.id);
      
      if (ids.length > 0) {
        for (const id of ids) {
          await db.delete(submissions).where(eq(submissions.id, id));
        }
      }
    } else {
      await db.delete(submissions).where(eq(submissions.isArchived, true));
    }
  }

  async getSettings(): Promise<any> {
    const s = await db.select().from(settings).limit(1);
    if (s.length === 0) {
      const [newSettings] = await db.insert(settings).values({}).returning();
      return newSettings;
    }
    return s[0];
  }

  async getAllStudents(): Promise<Student[]> {
    return await db.select().from(students).orderBy(students.nim);
  }

  async deleteStudent(id: number): Promise<void> {
    await db.delete(students).where(eq(students.id, id));
  }

  async updateSettings(data: any): Promise<any> {
    const s = await this.getSettings();
    const [updated] = await db.update(settings)
      .set(data)
      .where(eq(settings.id, s.id))
      .returning();
    return updated;
  }

  async seedQuestions(): Promise<void> {
    const count = await db.select().from(questions);
    if (count.length > 0) return;

    const sampleQuestions = [
      {
        text: "Apa ibukota Indonesia?",
        options: ["Jakarta", "Bandung", "Surabaya", "Medan"],
        correctIndex: 0
      },
      {
        text: "Bahasa pemrograman untuk membuat struktur halaman web adalah?",
        options: ["CSS", "HTML", "JavaScript", "PHP"],
        correctIndex: 1
      }
    ];

    await db.insert(questions).values(sampleQuestions);
  }

  async seedAdmin(): Promise<void> {
    const adminNims = ["admin", "0000", "00000"];
    const existingAdmins = await db.select().from(students).where(eq(students.isAdmin, true));
    
    // Only seed if no admins exist at all
    if (existingAdmins.length > 0) return;

    for (const nim of adminNims) {
      const existing = await this.getStudentByNim(nim);
      if (existing) {
        await db.update(students)
          .set({ isAdmin: true, password: "admin" })
          .where(eq(students.nim, nim));
      } else {
        await db.insert(students).values({
          nim: nim,
          fullName: nim === "admin" ? "Administrator" : "Panitia",
          className: "System",
          isAdmin: true,
          role: "admin",
          password: "admin"
        });
      }
    }
  }
}

export const storage = new DatabaseStorage();
