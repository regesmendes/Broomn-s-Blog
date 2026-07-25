-- AlterTable
ALTER TABLE "request_logs" ADD COLUMN     "sessionId" TEXT;

-- CreateIndex
CREATE INDEX "request_logs_userId_sessionId_createdAt_idx" ON "request_logs"("userId", "sessionId", "createdAt");
