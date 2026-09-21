-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Marketplace" AS ENUM ('CARDMARKET', 'EBAY', 'VINTED', 'SALON', 'DIRECT');

-- CreateEnum
CREATE TYPE "SaleFeeType" AS ENUM ('MARKETPLACE_COMMISSION', 'PAYMENT', 'SHIPPING_COST', 'PACKAGING', 'OTHER');

-- CreateTable
CREATE TABLE "Sale" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "marketplace" "Marketplace" NOT NULL,
    "buyerHandle" TEXT,
    "status" "SaleStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL,
    "shippingCharged" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "soldAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleLine" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "cardVariantId" UUID NOT NULL,
    "cardNameSnapshot" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "costBasisSnapshot" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleFee" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "type" "SaleFeeType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleReturn" (
    "id" UUID NOT NULL,
    "saleLineId" UUID NOT NULL,
    "refundAmount" DECIMAL(12,2) NOT NULL,
    "restock" BOOLEAN NOT NULL DEFAULT false,
    "returnedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sale_workspaceId_soldAt_idx" ON "Sale"("workspaceId", "soldAt");

-- CreateIndex
CREATE INDEX "Sale_workspaceId_status_idx" ON "Sale"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "SaleLine_saleId_idx" ON "SaleLine"("saleId");

-- CreateIndex
CREATE INDEX "SaleLine_inventoryItemId_idx" ON "SaleLine"("inventoryItemId");

-- CreateIndex
CREATE INDEX "SaleFee_saleId_idx" ON "SaleFee"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleReturn_saleLineId_key" ON "SaleReturn"("saleLineId");

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleFee" ADD CONSTRAINT "SaleFee_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_saleLineId_fkey" FOREIGN KEY ("saleLineId") REFERENCES "SaleLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
