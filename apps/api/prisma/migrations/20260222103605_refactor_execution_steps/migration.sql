-- CreateEnum
CREATE TYPE "ExecutionStepStatus" AS ENUM ('PASS', 'FAIL', 'BLOCKED', 'SKIPPED');

-- AlterTable
ALTER TABLE "TestExecution" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ExecutionStep" (
    "id" SERIAL NOT NULL,
    "executionId" INTEGER NOT NULL,
    "testCaseStepId" INTEGER NOT NULL,
    "actualResult" TEXT,
    "stepStatus" "ExecutionStepStatus",

    CONSTRAINT "ExecutionStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCaseStep" (
    "id" SERIAL NOT NULL,
    "testCaseId" INTEGER NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "expectedResult" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestCaseStep_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ExecutionStep" ADD CONSTRAINT "ExecutionStep_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "TestExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionStep" ADD CONSTRAINT "ExecutionStep_testCaseStepId_fkey" FOREIGN KEY ("testCaseStepId") REFERENCES "TestCaseStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseStep" ADD CONSTRAINT "TestCaseStep_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
