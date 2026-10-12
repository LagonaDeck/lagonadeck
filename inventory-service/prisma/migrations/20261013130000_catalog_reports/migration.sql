-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "CatalogReport" (
    "id" UUID NOT NULL,
    "productId" UUID,
    "message" TEXT NOT NULL,
    "reportedBy" UUID NOT NULL,
    "resolvedBy" UUID,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "CatalogReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogReport_status_createdAt_idx" ON "CatalogReport"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "CatalogReport" ADD CONSTRAINT "CatalogReport_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

