-- AlterTable
ALTER TABLE "Product" ADD COLUMN "hasReverse" BOOLEAN;

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN "reverse" BOOLEAN NOT NULL DEFAULT false;

-- DropIndex
DROP INDEX "InventoryItem_line_key";

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_line_key" ON "InventoryItem"("organizationId", "productId", "condition", "language", "gradingCompany", "grade", "reverse") NULLS NOT DISTINCT;
