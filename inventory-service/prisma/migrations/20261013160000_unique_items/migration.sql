-- DropIndex
DROP INDEX "InventoryItem_line_key";

-- Une ligne de N articles devient N exemplaires.
INSERT INTO "InventoryItem"
  ("id", "organizationId", "productId", "quantity", "condition", "language",
   "gradingCompany", "grade", "reverse", "createdAt", "updatedAt")
SELECT gen_random_uuid(), i."organizationId", i."productId", 1, i."condition", i."language",
  i."gradingCompany", i."grade", i."reverse", i."createdAt", i."updatedAt"
FROM "InventoryItem" i, generate_series(2, i."quantity");

-- AlterTable
ALTER TABLE "InventoryItem" DROP COLUMN "quantity";

-- CreateIndex
CREATE INDEX "InventoryItem_organizationId_idx" ON "InventoryItem"("organizationId");
