-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MAHASISWA', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('KULIAH', 'PRIBADI');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('FIXED_TIME', 'DEADLINE', 'ROUTINE');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MAHASISWA',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
    "locale" VARCHAR(5) NOT NULL DEFAULT 'id',
    "daily_capacity_hours" DECIMAL(4,1) NOT NULL DEFAULT 8,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" VARCHAR(255),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" CHAR(7) NOT NULL,
    "type" "CategoryType" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" VARCHAR(1000),
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "importance" SMALLINT NOT NULL,
    "difficulty" SMALLINT NOT NULL,
    "start_at" TIMESTAMPTZ(3),
    "end_at" TIMESTAMPTZ(3),
    "deadline_at" TIMESTAMPTZ(3),
    "duration_minutes" INTEGER,
    "routine_days" SMALLINT[],
    "routine_start_minute" SMALLINT,
    "done_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "remind_at" TIMESTAMPTZ(3) NOT NULL,
    "event_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ(3),
    "last_error" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_success_at" TIMESTAMPTZ(3),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mood_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "level" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mood_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "target_user_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "categories_user_id_type_idx" ON "categories"("user_id", "type");

-- CreateIndex
CREATE INDEX "tasks_user_id_status_idx" ON "tasks"("user_id", "status");

-- CreateIndex
CREATE INDEX "tasks_user_id_deadline_at_idx" ON "tasks"("user_id", "deadline_at");

-- CreateIndex
CREATE INDEX "tasks_user_id_start_at_idx" ON "tasks"("user_id", "start_at");

-- CreateIndex
CREATE INDEX "tasks_user_id_category_id_idx" ON "tasks"("user_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "mood_entries_user_id_created_at_idx" ON "mood_entries"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mood_entries" ADD CONSTRAINT "mood_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Manual constraints (Bagian 5.3 issues.md) ------------------------------

-- email harus lowercase
ALTER TABLE users ADD CONSTRAINT users_email_lower CHECK (email = lower(email));
ALTER TABLE users ADD CONSTRAINT users_role_locale CHECK (locale IN ('id','en'));
ALTER TABLE users ADD CONSTRAINT users_capacity CHECK (daily_capacity_hours BETWEEN 1 AND 24);

-- kategori: warna valid & nama unik per user+tipe (case-insensitive)
ALTER TABLE categories ADD CONSTRAINT categories_color_hex CHECK (color ~ '^#[0-9A-Fa-f]{6}$');
CREATE UNIQUE INDEX categories_user_type_name_uq ON categories (user_id, type, lower(name));

-- skala 1..5
ALTER TABLE tasks ADD CONSTRAINT tasks_scale CHECK (importance BETWEEN 1 AND 5 AND difficulty BETWEEN 1 AND 5);
ALTER TABLE mood_entries ADD CONSTRAINT mood_level CHECK (level BETWEEN 1 AND 5);

-- aturan per tipe tugas
ALTER TABLE tasks ADD CONSTRAINT tasks_by_type CHECK (
  (type = 'FIXED_TIME' AND start_at IS NOT NULL AND end_at IS NOT NULL AND end_at > start_at
       AND deadline_at IS NULL AND duration_minutes IS NULL AND cardinality(routine_days) = 0 AND routine_start_minute IS NULL)
  OR
  (type = 'DEADLINE' AND deadline_at IS NOT NULL AND duration_minutes >= 30
       AND start_at IS NULL AND end_at IS NULL AND cardinality(routine_days) = 0 AND routine_start_minute IS NULL)
  OR
  (type = 'ROUTINE' AND cardinality(routine_days) BETWEEN 1 AND 7 AND routine_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[]
       AND routine_start_minute BETWEEN 0 AND 1439 AND duration_minutes >= 15
       AND start_at IS NULL AND end_at IS NULL AND deadline_at IS NULL)
);

-- reminder: antrean efisien & hanya 1 PENDING per tugas
CREATE INDEX reminders_due_idx ON reminders (remind_at) WHERE status = 'PENDING';
CREATE UNIQUE INDEX reminders_one_pending_per_task ON reminders (task_id) WHERE status = 'PENDING';
