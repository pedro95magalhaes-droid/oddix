-- CreateTable
CREATE TABLE "public"."UserBetHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBetHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserBetHistory_userId_betId_key" ON "public"."UserBetHistory"("userId", "betId");

-- AddForeignKey
ALTER TABLE "public"."UserBetHistory" ADD CONSTRAINT "UserBetHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserBetHistory" ADD CONSTRAINT "UserBetHistory_betId_fkey" FOREIGN KEY ("betId") REFERENCES "public"."Bet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
