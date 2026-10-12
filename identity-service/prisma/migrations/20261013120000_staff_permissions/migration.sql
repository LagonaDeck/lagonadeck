-- CreateEnum
CREATE TYPE "StaffPermission" AS ENUM ('CATALOG_MANAGE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "staffPermissions" "StaffPermission"[] DEFAULT ARRAY[]::"StaffPermission"[];

