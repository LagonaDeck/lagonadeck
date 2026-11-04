-- AlterTable
ALTER TABLE "EmailConfirmation" ADD COLUMN     "invitationOrganizationId" UUID;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pendingEmail" TEXT;
