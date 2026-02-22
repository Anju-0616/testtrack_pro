-- AlterTable
ALTER TABLE "Bug" ADD COLUMN     "branchName" TEXT,
ADD COLUMN     "commitHash" TEXT,
ADD COLUMN     "fixNotes" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3);
