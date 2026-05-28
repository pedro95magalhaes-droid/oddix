-- AlterTable
ALTER TABLE "public"."Bet" ADD COLUMN     "analysis" TEXT,
ADD COLUMN     "markets" JSONB,
ADD COLUMN     "risk" TEXT;

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "role" SET DEFAULT 'USER',
ALTER COLUMN "plan" SET DEFAULT 'Free';
