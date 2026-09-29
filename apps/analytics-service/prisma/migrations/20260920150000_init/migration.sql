-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "workspaceId" UUID,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyWorkspaceKpi" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "feesTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "itemsSold" INTEGER NOT NULL DEFAULT 0,
    "itemsPurchased" INTEGER NOT NULL DEFAULT 0,
    "capitalInvested" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "stockCostValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "stockMarketValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyWorkspaceKpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPerformance" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "saleLineId" UUID NOT NULL,
    "inventoryItemId" UUID NOT NULL,
    "cardVariantId" UUID NOT NULL,
    "cardName" TEXT NOT NULL,
    "marketplaceId" UUID NOT NULL,
    "marketplaceNameSnapshot" TEXT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL,
    "holdingDays" INTEGER NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "netProceeds" DECIMAL(12,2) NOT NULL,
    "profit" DECIMAL(12,2) NOT NULL,
    "roi" DECIMAL(14,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_eventId_key" ON "Event"("eventId");

-- CreateIndex
CREATE INDEX "Event_type_occurredAt_idx" ON "Event"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "Event_workspaceId_occurredAt_idx" ON "Event"("workspaceId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyWorkspaceKpi_workspaceId_date_key" ON "DailyWorkspaceKpi"("workspaceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ItemPerformance_saleLineId_key" ON "ItemPerformance"("saleLineId");

-- CreateIndex
CREATE INDEX "ItemPerformance_workspaceId_soldAt_idx" ON "ItemPerformance"("workspaceId", "soldAt");

-- CreateIndex
CREATE INDEX "ItemPerformance_workspaceId_cardVariantId_idx" ON "ItemPerformance"("workspaceId", "cardVariantId");

-- CreateIndex
CREATE INDEX "ItemPerformance_workspaceId_marketplaceId_idx" ON "ItemPerformance"("workspaceId", "marketplaceId");

-- CreateIndex
CREATE INDEX "ItemPerformance_inventoryItemId_idx" ON "ItemPerformance"("inventoryItemId");
