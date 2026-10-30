-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Purchase" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "supplier" TEXT NOT NULL,
    "purchasedAt" DATE NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "fees" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLine" (
    "id" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productName" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "setCode" TEXT,
    "setName" TEXT,
    "cardNumber" TEXT,
    "imageUrl" TEXT,
    "condition" TEXT,
    "language" TEXT,
    "gradingCompany" TEXT,
    "grade" DECIMAL(3,1),
    "reverse" BOOLEAN NOT NULL,
    "marketPrice" DECIMAL(12,2),
    "cost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Purchase_organizationId_purchasedAt_idx" ON "Purchase"("organizationId", "purchasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseLine_inventoryItemId_key" ON "PurchaseLine"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseLine_purchaseId_position_key" ON "PurchaseLine"("purchaseId", "position");

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
