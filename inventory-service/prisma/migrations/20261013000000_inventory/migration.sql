-- Recherche tolérante aux fautes de frappe : trigrammes pour trouver, distance
-- d'édition pour classer.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SINGLE', 'BOOSTER', 'BOOSTER_DISPLAY', 'ELITE_TRAINER_BOX', 'BOX_SET', 'TIN', 'BUNDLE', 'PRECONSTRUCTED_DECK', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('TCGDEX', 'CARDMARKET', 'MANUAL');

-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('MINT', 'NEAR_MINT', 'EXCELLENT', 'GOOD', 'LIGHT_PLAYED', 'PLAYED', 'POOR');

-- CreateEnum
CREATE TYPE "GradingCompany" AS ENUM ('PSA', 'BECKETT', 'CGC', 'SGC', 'PCA');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('ENGLISH', 'FRENCH', 'GERMAN', 'SPANISH', 'ITALIAN', 'SIMPLIFIED_CHINESE', 'JAPANESE', 'PORTUGUESE', 'RUSSIAN', 'KOREAN', 'TRADITIONAL_CHINESE');

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "source" "ProductSource" NOT NULL,
    "productType" "ProductType" NOT NULL,
    "tcgdexId" TEXT,
    "name" TEXT NOT NULL,
    "englishName" TEXT,
    "setCode" TEXT,
    "setName" TEXT,
    "cardNumber" TEXT,
    "rarity" TEXT,
    "imageUrl" TEXT,
    "moves" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tcgdexCardmarketIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "cardmarketId" INTEGER,
    "cardmarketLinkedByUser" BOOLEAN NOT NULL DEFAULT false,
    "searchText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardmarketProduct" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "expansionId" INTEGER,
    "single" BOOLEAN NOT NULL,
    "trend" DECIMAL(12,2),
    "low" DECIMAL(12,2),
    "avg1" DECIMAL(12,2),
    "avg7" DECIMAL(12,2),
    "avg30" DECIMAL(12,2),
    "trendHolo" DECIMAL(12,2),
    "priceDate" TIMESTAMP(3),

    CONSTRAINT "CardmarketProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "condition" "Condition",
    "language" "Language",
    "gradingCompany" "GradingCompany",
    "grade" DECIMAL(3,1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncedFile" (
    "url" TEXT NOT NULL,
    "etag" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncedFile_pkey" PRIMARY KEY ("url")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_tcgdexId_key" ON "Product"("tcgdexId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_cardmarketId_key" ON "Product"("cardmarketId");

-- CreateIndex
CREATE INDEX "Product_searchText_idx" ON "Product" USING GIN ("searchText" gin_trgm_ops);

-- NULLS NOT DISTINCT : un produit sans set ni numéro reste unique par nom.
CREATE UNIQUE INDEX "Product_manual_key" ON "Product"("productType", "name", "setCode", "cardNumber") NULLS NOT DISTINCT WHERE ("source" = 'MANUAL');

-- CreateIndex
CREATE INDEX "InventoryItem_productId_idx" ON "InventoryItem"("productId");

-- NULLS NOT DISTINCT : une ligne sans état, langue ni gradation reste unique par produit.
CREATE UNIQUE INDEX "InventoryItem_line_key" ON "InventoryItem"("organizationId", "productId", "condition", "language", "gradingCompany", "grade") NULLS NOT DISTINCT;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_cardmarketId_fkey" FOREIGN KEY ("cardmarketId") REFERENCES "CardmarketProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

