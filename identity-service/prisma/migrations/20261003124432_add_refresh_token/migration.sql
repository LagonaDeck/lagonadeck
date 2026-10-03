-- AlterTable
ALTER TABLE "Session" ADD COLUMN "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN "refreshTokenHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");
