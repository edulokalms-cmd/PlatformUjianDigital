
import { z } from 'zod';
import { insertStudentSchema, students, questions, submissions, insertQuestionSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/auth/login',
      input: z.object({ 
        nim: z.string().min(1, "NIM/Username wajib diisi"),
        password: z.string().optional()
      }),
      responses: {
        200: z.object({
          student: z.custom<typeof students.$inferSelect>(),
          hasBiodata: z.boolean(),
          isAdmin: z.boolean(),
          activeSubmissionId: z.number().optional()
        }),
        401: errorSchemas.unauthorized,
      },
    },
    updateBiodata: {
      method: 'PUT' as const,
      path: '/api/students/:id',
      input: z.object({
        fullName: z.string().min(1, "Nama lengkap wajib diisi"),
        className: z.string().min(1, "Kelas wajib diisi")
      }),
      responses: {
        200: z.custom<typeof students.$inferSelect>(),
      },
    }
  },
  exam: {
    start: {
      method: 'POST' as const,
      path: '/api/exam/start',
      input: z.object({ studentId: z.number() }),
      responses: {
        201: z.custom<typeof submissions.$inferSelect>(),
      }
    },
    questions: {
      method: 'GET' as const,
      path: '/api/exam/questions',
      responses: {
        200: z.array(z.custom<Omit<typeof questions.$inferSelect, "correctIndex">>()),
      }
    },
    submit: {
      method: 'POST' as const,
      path: '/api/exam/:submissionId/submit',
      input: z.object({ 
        answers: z.record(z.string(), z.number()) 
      }),
      responses: {
        200: z.custom<typeof submissions.$inferSelect>(),
      }
    },
    result: {
      method: 'GET' as const,
      path: '/api/exam/:submissionId/result',
      responses: {
        200: z.custom<typeof submissions.$inferSelect>(),
        404: errorSchemas.notFound
      }
    }
  },
  admin: {
    questions: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/questions',
        responses: {
          200: z.array(z.custom<typeof questions.$inferSelect>()),
        }
      },
      create: {
        method: 'POST' as const,
        path: '/api/admin/questions',
        input: insertQuestionSchema,
        responses: {
          201: z.custom<typeof questions.$inferSelect>(),
        }
      },
      delete: {
        method: 'DELETE' as const,
        path: '/api/admin/questions/:id',
        responses: {
          204: z.void(),
        }
      }
    },
    submissions: {
      list: {
        method: 'GET' as const,
        path: '/api/admin/submissions',
        responses: {
          200: z.array(z.object({
            submission: z.custom<typeof submissions.$inferSelect>(),
            student: z.custom<typeof students.$inferSelect>()
          })),
        }
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
