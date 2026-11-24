-- CreateTable
CREATE TABLE "Sale" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "buyer" TEXT NOT NULL,
    "soldAt" DATE NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "fees" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleLine" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
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
    "price" DECIMAL(12,2) NOT NULL,
    "fees" DECIMAL(12,2) NOT NULL,
    "cost" DECIMAL(12,2),

    CONSTRAINT "SaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sale_organizationId_soldAt_idx" ON "Sale"("organizationId", "soldAt");

-- CreateIndex
CREATE UNIQUE INDEX "SaleLine_inventoryItemId_key" ON "SaleLine"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SaleLine_saleId_position_key" ON "SaleLine"("saleId", "position");

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
