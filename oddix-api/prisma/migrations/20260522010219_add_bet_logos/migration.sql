-- AlterTable
ALTER TABLE "public"."Bet" ADD COLUMN     "awayLogo" TEXT,
ADD COLUMN     "fixtureId" INTEGER,
ADD COLUMN     "gameDate" TIMESTAMP(3),
ADD COLUMN     "homeLogo" TEXT,
ADD COLUMN     "leagueLogo" TEXT;
