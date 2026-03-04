-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "assignedToId" INTEGER;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
