-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('DISCOVERY');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('ORGANIZATION_MANAGE', 'GROUP_CREATE', 'GROUP_UPDATE', 'GROUP_DELETE', 'GROUP_MANAGE_PERMISSIONS', 'MEMBER_INVITE', 'MEMBER_REMOVE', 'MEMBER_MANAGE_GROUPS', 'BILLING_VIEW', 'BILLING_MANAGE');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'DISCOVERY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("organizationId","userId")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "permissions" "Permission"[] DEFAULT ARRAY[]::"Permission"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "groupId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_organizationId_name_key" ON "Group"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Group_id_organizationId_key" ON "Group"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_single_owner_key" ON "Group"("organizationId") WHERE ("isOwner" = true);

-- CreateIndex
CREATE INDEX "GroupMember_organizationId_userId_idx" ON "GroupMember"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_organizationId_fkey" FOREIGN KEY ("groupId", "organizationId") REFERENCES "Group"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_organizationId_userId_fkey" FOREIGN KEY ("organizationId", "userId") REFERENCES "OrganizationMember"("organizationId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Rattrapage : chaque utilisateur existant reçoit son organisation personnelle,
-- comme à la création d'un compte.
CREATE TEMP TABLE "_personal_org" AS
SELECT "id" AS "userId", "username", gen_random_uuid() AS "organizationId", gen_random_uuid() AS "ownerGroupId"
FROM "User";

INSERT INTO "Organization" ("id", "name", "updatedAt")
SELECT "organizationId", 'Organisation de ' || "username", CURRENT_TIMESTAMP FROM "_personal_org";

INSERT INTO "OrganizationMember" ("organizationId", "userId")
SELECT "organizationId", "userId" FROM "_personal_org";

INSERT INTO "Group" ("id", "organizationId", "name", "isOwner", "updatedAt")
SELECT "ownerGroupId", "organizationId", 'Owner', true, CURRENT_TIMESTAMP FROM "_personal_org";

INSERT INTO "Group" ("id", "organizationId", "name", "updatedAt")
SELECT gen_random_uuid(), "organizationId", 'Member', CURRENT_TIMESTAMP FROM "_personal_org";

INSERT INTO "GroupMember" ("groupId", "organizationId", "userId")
SELECT "ownerGroupId", "organizationId", "userId" FROM "_personal_org";

DROP TABLE "_personal_org";
