-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "cardmarketId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "trend" DECIMAL(12,2),
    "low" DECIMAL(12,2),
    "avg1" DECIMAL(12,2),
    "avg7" DECIMAL(12,2),
    "avg30" DECIMAL(12,2),

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("cardmarketId","date")
);

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_cardmarketId_fkey" FOREIGN KEY ("cardmarketId") REFERENCES "CardmarketProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

