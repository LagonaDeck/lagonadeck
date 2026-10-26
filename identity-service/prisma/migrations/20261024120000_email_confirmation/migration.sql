-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailConfirmedAt" TIMESTAMP(3);

-- Les comptes créés avant la confirmation par e-mail restent utilisables.
UPDATE "User" SET "emailConfirmedAt" = "createdAt";

-- CreateTable
CREATE TABLE "EmailConfirmation" (
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailConfirmation_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailConfirmation_userId_key" ON "EmailConfirmation"("userId");

-- AddForeignKey
ALTER TABLE "EmailConfirmation" ADD CONSTRAINT "EmailConfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
