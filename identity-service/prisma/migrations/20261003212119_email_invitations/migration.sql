-- CreateTable
CREATE TABLE "EmailInvitation" (
    "organizationId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "invitedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailInvitation_pkey" PRIMARY KEY ("organizationId","email")
);

-- CreateIndex
CREATE INDEX "EmailInvitation_email_idx" ON "EmailInvitation"("email");

-- AddForeignKey
ALTER TABLE "EmailInvitation" ADD CONSTRAINT "EmailInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailInvitation" ADD CONSTRAINT "EmailInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

