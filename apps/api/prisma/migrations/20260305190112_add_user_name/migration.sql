/*
  Warnings:

  - The values [READY] on the enum `Status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to alter the column `title` on the `TestCase` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.
  - You are about to drop the column `duration` on the `TestExecution` table. All the data in the column will be lost.
  - You are about to drop the column `executedAt` on the `TestExecution` table. All the data in the column will be lost.
  - You are about to drop the column `testcaseId` on the `TestExecution` table. All the data in the column will be lost.
  - The `status` column on the `TestExecution` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `refreshToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `ExecutionStep` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `testCaseId` to the `TestExecution` table without a default value. This is not possible if the table is not empty.
  - Made the column `startedAt` on table `TestExecution` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "TestType" AS ENUM ('FUNCTIONAL', 'REGRESSION', 'SMOKE', 'INTEGRATION', 'UAT', 'PERFORMANCE', 'SECURITY', 'USABILITY');

-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('NOT_AUTOMATED', 'IN_PROGRESS', 'AUTOMATED', 'CANNOT_AUTOMATE');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('IN_PROGRESS', 'PASSED', 'FAILED', 'BLOCKED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TestRunStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ABORTED');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'PASS', 'FAIL', 'BLOCKED', 'SKIPPED');

-- AlterEnum
BEGIN;
CREATE TYPE "Status_new" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'DEPRECATED', 'ARCHIVED');
ALTER TABLE "public"."TestCase" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "TestCase" ALTER COLUMN "status" TYPE "Status_new" USING ("status"::text::"Status_new");
ALTER TYPE "Status" RENAME TO "Status_old";
ALTER TYPE "Status_new" RENAME TO "Status";
DROP TYPE "public"."Status_old";
ALTER TABLE "TestCase" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- DropForeignKey
ALTER TABLE "ExecutionStep" DROP CONSTRAINT "ExecutionStep_executionId_fkey";

-- DropForeignKey
ALTER TABLE "ExecutionStep" DROP CONSTRAINT "ExecutionStep_testCaseStepId_fkey";

-- DropForeignKey
ALTER TABLE "TestExecution" DROP CONSTRAINT "TestExecution_testcaseId_fkey";

-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "automationScriptLink" TEXT,
ADD COLUMN     "automationStatus" "AutomationStatus" NOT NULL DEFAULT 'NOT_AUTOMATED',
ADD COLUMN     "cleanupSteps" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedBy" INTEGER,
ADD COLUMN     "environmentRequirements" TEXT,
ADD COLUMN     "estimatedDuration" INTEGER,
ADD COLUMN     "postconditions" TEXT,
ADD COLUMN     "preconditions" TEXT,
ADD COLUMN     "severity" "Severity" NOT NULL DEFAULT 'MAJOR',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "testDataRequirements" TEXT,
ADD COLUMN     "type" "TestType" NOT NULL DEFAULT 'FUNCTIONAL',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "title" SET DATA TYPE VARCHAR(200);

-- AlterTable
ALTER TABLE "TestCaseStep" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "testData" TEXT;

-- AlterTable
ALTER TABLE "TestExecution" DROP COLUMN "duration",
DROP COLUMN "executedAt",
DROP COLUMN "testcaseId",
ADD COLUMN     "testCaseId" INTEGER NOT NULL,
ADD COLUMN     "testRunId" INTEGER,
ADD COLUMN     "timeSpent" INTEGER,
DROP COLUMN "status",
ADD COLUMN     "status" "ExecutionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
ALTER COLUMN "startedAt" SET NOT NULL,
ALTER COLUMN "startedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "refreshToken";

-- DropTable
DROP TABLE "ExecutionStep";

-- CreateTable
CREATE TABLE "TestCaseHistory" (
    "id" SERIAL NOT NULL,
    "testCaseId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "changedBy" INTEGER NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCaseHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSuite" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT,
    "parentId" INTEGER,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestSuite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSuiteCase" (
    "id" SERIAL NOT NULL,
    "suiteId" INTEGER NOT NULL,
    "testCaseId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TestSuiteCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestRun" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "TestRunStatus" NOT NULL DEFAULT 'PLANNED',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "milestoneId" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepResult" (
    "id" SERIAL NOT NULL,
    "executionId" INTEGER NOT NULL,
    "stepId" INTEGER NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "actualResult" TEXT,
    "notes" TEXT,

    CONSTRAINT "StepResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TestCaseHistory_testCaseId_idx" ON "TestCaseHistory"("testCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "TestSuiteCase_suiteId_testCaseId_key" ON "TestSuiteCase"("suiteId", "testCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "StepResult_executionId_stepId_key" ON "StepResult"("executionId", "stepId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "TestCaseStep_testCaseId_idx" ON "TestCaseStep"("testCaseId");

-- CreateIndex
CREATE INDEX "TestExecution_testCaseId_idx" ON "TestExecution"("testCaseId");

-- CreateIndex
CREATE INDEX "TestExecution_testRunId_idx" ON "TestExecution"("testRunId");

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseHistory" ADD CONSTRAINT "TestCaseHistory_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseHistory" ADD CONSTRAINT "TestCaseHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSuite" ADD CONSTRAINT "TestSuite_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TestSuite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSuite" ADD CONSTRAINT "TestSuite_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSuiteCase" ADD CONSTRAINT "TestSuiteCase_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "TestSuite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSuiteCase" ADD CONSTRAINT "TestSuiteCase_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestExecution" ADD CONSTRAINT "TestExecution_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestExecution" ADD CONSTRAINT "TestExecution_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepResult" ADD CONSTRAINT "StepResult_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "TestExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepResult" ADD CONSTRAINT "StepResult_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "TestCaseStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
