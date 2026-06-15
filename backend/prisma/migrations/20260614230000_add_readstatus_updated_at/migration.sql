-- AlterTable: add updatedAt to ReadStatus.
-- The DEFAULT CURRENT_TIMESTAMP backfills existing rows at migration time;
-- Prisma's @updatedAt then drives the value on every subsequent write.
ALTER TABLE "ReadStatus"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex: the delta-sync endpoint filters by (userId, updatedAt > since).
CREATE INDEX "ReadStatus_userId_updatedAt_idx" ON "ReadStatus"("userId", "updatedAt");
