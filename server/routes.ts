
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Export questions to DOCX
  app.get("/api/admin/questions/export", async (req, res) => {
    try {
      const questions = await storage.getQuestions();
      const courseName = req.query.courseName as string;

      const normalize = (str: string) => str.toLowerCase().trim().replace(/\s+/g, ' ');

      let filteredQuestions = questions;
      if (courseName && courseName !== 'all') {
        const normalizedCourse = normalize(courseName);
        filteredQuestions = questions.filter(q => q.courseName && normalize(q.courseName) === normalizedCourse);
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: `BANK SOAL - ${courseName && courseName !== 'all' ? courseName.toUpperCase() : 'SEMUA MATA KULIAH'}`,
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: "" }),
            ...filteredQuestions.flatMap((q, i) => {
              const questionContent = [
                new Paragraph({
                  children: [
                    new TextRun({ text: `${i + 1}. `, bold: true }),
                    new TextRun({ text: q.text }),
                  ],
                }),
              ];

              if (q.type === 'multiple_choice' || q.type === 'true_false') {
                q.options.forEach((opt, optIdx) => {
                  questionContent.push(new Paragraph({
                    indent: { left: 720 },
                    children: [
                      new TextRun({ text: `${String.fromCharCode(65 + optIdx)}. `, bold: true }),
                      new TextRun({ text: opt }),
                    ],
                  }));
                });
              } else if (q.type === 'ordering') {
                q.options.forEach((opt, optIdx) => {
                  questionContent.push(new Paragraph({
                    indent: { left: 720 },
                    children: [
                      new TextRun({ text: `${optIdx + 1}. `, bold: true }),
                      new TextRun({ text: opt }),
                    ],
                  }));
                });
              }

              // Add Answer Key
              let answerText = "";
              if (q.type === 'multiple_choice' || q.type === 'true_false') {
                answerText = `Kunci Jawaban: ${String.fromCharCode(65 + (q.correctIndex || 0))}`;
              } else if (q.type === 'ordering') {
                answerText = `Kunci Jawaban: (Urutan Asli) ${q.options.join(" -> ")}`;
              } else if (q.type === 'essay' || q.type === 'short_answer') {
                answerText = `Kunci Jawaban: ${q.correctText || "-"}`;
              } else if (q.type === 'matching') {
                answerText = `Kunci Jawaban: ${q.correctText || "-"}`;
              }

              questionContent.push(new Paragraph({
                indent: { left: 720 },
                children: [
                  new TextRun({ text: answerText, italics: true, color: "FF0000" }),
                ],
              }));

              questionContent.push(new Paragraph({ text: "" }));
              return questionContent;
            })
          ],
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename=bank_soal_${courseName || 'semua'}.docx`);
      res.send(buffer);
    } catch (error) {
      console.error("Export DOCX error:", error);
      res.status(500).json({ message: "Gagal membuat file DOCX" });
    }
  });

      // Auth: Login
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const { nim, password } = api.auth.login.input.parse(req.body);
      const normalizedNim = nim.trim().toLowerCase();
      
      // LOG FOR DEBUGGING
      console.log(`Login attempt: NIM='${normalizedNim}', password='${password}'`);

      const isAdminNim = normalizedNim === "admin" || normalizedNim === "0000" || normalizedNim === "00000";
      
      let student = await storage.getStudentByNim(normalizedNim);

      if (!student) {
        if (isAdminNim) {
          // Check if any admin exists before seeding
          const allStudents = await storage.getAllStudents();
          const hasAdmin = allStudents.some(s => s.isAdmin);
          if (!hasAdmin) {
            await storage.seedAdmin();
            student = await storage.getStudentByNim(normalizedNim);
          }
        } else {
          student = await storage.createStudent({ nim: normalizedNim });
        }
      }

      if (!student) {
        return res.status(401).json({ message: "Pengguna tidak ditemukan" });
      }

      // Check Admin/Pengawas Password
      if (isAdminNim || student.isAdmin || student.role === 'pengawas') {
        const providedPassword = password?.trim();
        
        // If password is NOT provided yet, return success but flag that password is required
        if (password === undefined) {
           return res.json({ 
             student, 
             hasBiodata: true, 
             isAdmin: true,
             requiresPassword: true
           });
        }
        
        if (providedPassword === "admin" || providedPassword === student.password) {
          // CORRECT LOGIN
          return res.json({ 
            student: { ...student, isAdmin: true }, 
            hasBiodata: true, 
            isAdmin: true,
            requiresPassword: false 
          });
        } else {
          return res.status(401).json({ message: "Password salah" });
        }
      }

      // If it's NOT an admin NIM, we treat it as a regular student
      const hasBiodata = !!(student.fullName && student.className);
      res.json({ 
        student: { ...student, isAdmin: false }, 
        hasBiodata, 
        isAdmin: false,
        requiresPassword: false
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ message: "Request tidak valid" });
    }
  });

  // Auth: Update Biodata
  app.put("/api/students/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateStudent(id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: "Gagal memperbarui biodata" });
    }
  });

  // Exam Endpoints
  app.post(api.exam.start.path, async (req, res) => {
    try {
      const { studentId } = api.exam.start.input.parse(req.body);
      const submission = await storage.createSubmission(studentId);
      res.status(201).json(submission);
    } catch (error: any) {
      res.status(403).json({ message: error.message || "Gagal memulai ujian" });
    }
  });

  app.get(api.exam.questions.path, async (req, res) => {
    const questions = await storage.getQuestions();
    const courseName = req.query.courseName as string;
    
    // Helper to normalize strings for comparison
    const normalize = (str: string) => str ? str.toLowerCase().trim().replace(/\s+/g, ' ') : "";

    let filteredQuestions = questions;
    if (courseName && courseName !== 'all') {
      const normalizedCourse = normalize(courseName);
      filteredQuestions = questions.filter(q => q.courseName && normalize(q.courseName) === normalizedCourse);
    }
    
    const publicQuestions = filteredQuestions.map(({ correctIndex, ...q }) => q);
    res.json(publicQuestions);
  });

  app.post(api.exam.submit.path, async (req, res) => {
    try {
      const submissionId = parseInt(req.params.submissionId);
      // Skip strict Zod validation of body to prevent crashes with mixed data types
      
      // Helper to normalize strings for comparison
      const normalize = (str: string) => str ? str.toLowerCase().trim().replace(/\s+/g, ' ') : "";

      const submission = await storage.getSubmission(submissionId);
      if (!submission) return res.status(404).json({ message: "Submission not found" });

      const allStudents = await storage.getAllStudents();
      const currentStudent = allStudents.find(s => s.id === submission.studentId);
      
      if (!currentStudent) return res.status(404).json({ message: "Student not found" });

      const answers = req.body.answers || {};
      const allQuestions = await storage.getQuestions();
      
      // FALLBACK: If student.course is missing in DB, try localStorage-equivalent (passed in body or just use all for safety)
      // However, we just added the column and Biodata should fill it.
      const studentCourse = normalize(currentStudent.course || "");
      
      console.log(`Submitting for student ${currentStudent.nim}, course: "${studentCourse}"`);

      // Filter questions to only include those from the student's selected course
      let questions = allQuestions.filter(q => 
        q.courseName && studentCourse && normalize(q.courseName) === studentCourse
      );
      
      // If still no questions, log it for debugging
      if (questions.length === 0) {
        console.error(`No questions found for course: "${studentCourse}"`);
        // If no course is found, maybe they are taking an old session. 
        // Let's try to match ANY course if it's strictly empty to avoid blocking.
        if (!studentCourse) {
           questions = allQuestions;
        } else {
           return res.status(400).json({ message: `Tidak ada soal untuk mata kuliah: ${studentCourse}` });
        }
      }

      let totalPoints = 0;
      let earnedPoints = 0;

      questions.forEach((q) => {
        totalPoints += (q.points || 10);
        const studentAnswer = answers[String(q.id)];
        
        if (studentAnswer !== undefined && studentAnswer !== null) {
          if (q.type === 'ordering') {
            // Compare arrays for ordering
            if (Array.isArray(studentAnswer) && JSON.stringify(studentAnswer) === JSON.stringify(q.options)) {
              earnedPoints += (q.points || 10);
            }
          } else if (q.type === 'essay') {
            // Essay scoring: auto-grant points based on keyword matching
            const essayAnswer = String(studentAnswer || "").trim().toLowerCase();
            const correctRef = (q.correctText || "").trim().toLowerCase();
            
            if (essayAnswer.length > 0) {
              if (correctRef.length > 0) {
                // Simple keyword/similarity check: if student answer contains at least 30% of key words from reference
                const refWords = correctRef.split(/\s+/).filter(w => w.length > 3);
                if (refWords.length > 0) {
                  const matchedWords = refWords.filter(w => essayAnswer.includes(w));
                  const matchRatio = matchedWords.length / refWords.length;
                  if (matchRatio >= 0.3) {
                    earnedPoints += (q.points || 10);
                  } else if (matchRatio > 0) {
                    earnedPoints += Math.round((q.points || 10) * matchRatio);
                  }
                } else {
                  // If ref is short, direct inclusion
                  if (essayAnswer.includes(correctRef)) {
                    earnedPoints += (q.points || 10);
                  }
                }
              } else {
                // Fallback: auto-grant if not empty if no ref provided
                earnedPoints += (q.points || 10);
              }
            }
          } else if (q.type === 'matching') {
            // Matching scoring: Check if student matches all pairs correctly
            try {
              const correctMatches = typeof q.correctText === 'string' ? JSON.parse(q.correctText || "{}") : q.correctText || {};
              // Normalize studentAnswer and correctMatches for comparison
              const studentMatches = typeof studentAnswer === 'object' ? studentAnswer : {};
              
              const keys = Object.keys(correctMatches);
              if (keys.length > 0) {
                const isAllCorrect = keys.every(key => 
                  normalize(String(studentMatches[key] || "")) === normalize(String(correctMatches[key] || ""))
                );
                
                if (isAllCorrect) {
                  earnedPoints += (q.points || 10);
                }
              }
            } catch (e) {
              console.error("Matching scoring error:", e);
            }
          } else if (q.type === 'short_answer') {
            const studentTxt = String(studentAnswer || "").trim().toLowerCase();
            const correctTxt = (q.correctText || "").trim().toLowerCase();
            if (studentTxt === correctTxt) {
              earnedPoints += (q.points || 10);
            }
          } else {
            // Standard multiple choice / true-false
            if (studentAnswer == q.correctIndex) {
              earnedPoints += (q.points || 10);
            }
          }
        }
      });

      const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      const result = await storage.completeSubmission(submissionId, answers, score);
      res.json(result);
    } catch (error) {
      console.error("Submit error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.exam.result.path, async (req, res) => {
    const submissionId = parseInt(req.params.submissionId);
    const submission = await storage.getSubmission(submissionId);
    if (!submission) return res.status(404).json({ message: "Data tidak ditemukan" });
    res.json(submission);
  });

  // Admin Endpoints
  app.get(api.admin.questions.list.path, async (req, res) => {
    const q = await storage.getQuestions();
    res.json(q);
  });

  app.get("/api/admin/settings", async (req, res) => {
    const s = await storage.getSettings();
    res.json(s);
  });

  app.patch("/api/admin/settings", async (req, res) => {
    const updated = await storage.updateSettings(req.body);
    res.json(updated);
  });

  app.post(api.admin.questions.create.path, async (req, res) => {
    const input = api.admin.questions.create.input.parse(req.body);
    const newQ = await storage.createQuestion(input);
    res.status(201).json(newQ);
  });

  app.delete(api.admin.questions.delete.path, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteQuestion(id);
    res.status(204).send();
  });

  app.patch("/api/admin/questions/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const input = api.admin.questions.create.input.partial().parse(req.body);
    const updated = await storage.updateQuestion(id, input);
    res.json(updated);
  });

  app.get(api.admin.submissions.list.path, async (req, res) => {
    const results = await storage.getAllSubmissions();
    res.json(results);
  });

  app.get("/api/admin/students", async (req, res) => {
    const s = await storage.getAllStudents();
    res.json(s);
  });

  app.post("/api/admin/students", async (req, res) => {
    try {
      const student = await storage.createStudent(req.body);
      res.status(201).json(student);
    } catch (error) {
      res.status(400).json({ message: "Gagal membuat user" });
    }
  });

  app.post("/api/admin/students/import", async (req, res) => {
    try {
      const data = req.body;
      if (!Array.isArray(data)) throw new Error("Format data tidak valid");
      
      const results = [];
      for (const item of data) {
        // Map common Excel headers to schema fields
        const nim = String(item.NIM || item.nim || item.Username || item.username || "").trim();
        const fullName = String(item.Nama || item.nama || item["Nama Lengkap"] || item.fullName || "").trim();
        const className = String(item.Kelas || item.kelas || item.className || "").trim();
        const isAdmin = String(item.Role || "").toLowerCase().includes("admin") || !!item.isAdmin;

        if (nim) {
          const student = await storage.createStudent({
            nim,
            fullName: fullName || null,
            className: className || null,
            isAdmin,
            password: isAdmin ? (item.Password || item.password || "admin") : null
          });
          results.push(student);
        }
      }
      res.status(201).json(results);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Gagal import data" });
    }
  });

  app.patch("/api/admin/students/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateStudent(id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: "Gagal memperbarui user" });
    }
  });

  app.delete("/api/admin/students/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteStudent(id);
    res.status(204).send();
  });

  app.delete("/api/admin/submissions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteSubmission(id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ message: "Gagal menghapus hasil ujian" });
    }
  });

  app.post("/api/admin/submissions/bulk-delete", async (req, res) => {
    try {
      const { className, minScore, maxScore, courseName } = req.body;
      await storage.bulkDeleteSubmissions({ className, minScore, maxScore, courseName });
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ message: "Gagal melakukan reset masal" });
    }
  });

  app.get("/api/admin/submissions/archived", async (req, res) => {
    try {
      const results = await storage.getArchivedSubmissions();
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/submissions/:id/details", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const submission = await storage.getSubmission(id);
      if (!submission) return res.status(404).json({ message: "Submission not found" });
      
      const student = (await storage.getAllStudents()).find(s => s.id === submission.studentId);
      const questions = await storage.getQuestions();
      
      res.json({
        submission,
        student,
        questions: questions.filter(q => {
          const studentCourse = student?.course?.toLowerCase().trim();
          const questionCourse = q.courseName?.toLowerCase().trim();
          return studentCourse && questionCourse && studentCourse === questionCourse;
        })
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/submissions/archived/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteArchivedSubmission(id);
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ message: "Gagal menghapus arsip" });
    }
  });

  app.post("/api/admin/submissions/archived/clear", async (req, res) => {
    try {
      const { className } = req.body;
      await storage.clearArchive({ className });
      res.status(204).send();
    } catch (error) {
      res.status(400).json({ message: "Gagal membersihkan arsip" });
    }
  });

  // Seed Data
  await storage.seedQuestions();
  await storage.seedAdmin();

  return httpServer;
}
