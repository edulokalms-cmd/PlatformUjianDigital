# Panduan Migrasi MySQL/MariaDB (Hostinger)

Karena Anda menggunakan Hostinger yang mendukung MySQL/MariaDB, berikut adalah panduan untuk menyesuaikan kode agar kompatibel:

## 1. Perubahan Skema (`shared/schema.ts`)
MySQL tidak memiliki tipe data `jsonb` atau `serial`. Gunakan penyesuaian berikut:

```typescript
// Ganti import
import { mysqlTable, text, int, boolean, timestamp, json } from "drizzle-orm/mysql-core";

// Contoh tabel students
export const students = mysqlTable("students", {
  id: int("id").primaryKey().autoincrement(),
  nim: text("nim").notNull(),
  // ... field lainnya
  role: text("role").notNull().default("student"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

## 2. Koneksi Database (`server/db.ts`)
Ganti driver `postgres` dengan `mysql2`:

```typescript
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL!);
export const db = drizzle(connection);
```

## 3. Penanganan Data JSON
MySQL menggunakan `json()` bukan `jsonb()`. Saat melakukan query, pastikan data array/objek ditangani sebagai JSON string atau objek sesuai versi MySQL yang digunakan.

## 4. Dependensi
Instal paket berikut:
`npm install drizzle-orm mysql2`
`npm install -D drizzle-kit`

---
*Catatan: Aplikasi di Replit ini tetap menggunakan PostgreSQL untuk stabilitas lingkungan pengembangan.*
