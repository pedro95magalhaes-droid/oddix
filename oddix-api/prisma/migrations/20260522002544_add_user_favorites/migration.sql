-- CreateTable
CREATE TABLE "public"."UserFavoriteBet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFavoriteBet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserFavoriteBet_userId_betId_key" ON "public"."UserFavoriteBet"("userId", "betId");

-- AddForeignKey
ALTER TABLE "public"."UserFavoriteBet" ADD CONSTRAINT "UserFavoriteBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserFavoriteBet" ADD CONSTRAINT "UserFavoriteBet_betId_fkey" FOREIGN KEY ("betId") REFERENCES "public"."Bet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
