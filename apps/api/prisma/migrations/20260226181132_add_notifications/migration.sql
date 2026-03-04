-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TESTER', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'TRIVIAL');

-- CreateEnum
CREATE TYPE "BugPriority" AS ENUM ('P1_URGENT', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW');

-- CreateEnum
CREATE TYPE "BugStatus" AS ENUM ('NEW', 'OPEN', 'IN_PROGRESS', 'FIXED', 'VERIFIED', 'CLOSED', 'REOPENED', 'WONT_FIX', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "ExecutionStepStatus" AS ENUM ('PASS', 'FAIL', 'BLOCKED', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "id" SERIAL NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TESTER',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "verificationTokenExpiry" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExpiry" TIMESTAMP(3),
    "refreshToken" TEXT,
    "dashboardLayout" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "Status" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "id" SERIAL NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "module" TEXT NOT NULL,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordHistory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestExecution" (
    "id" SERIAL NOT NULL,
    "testcaseId" INTEGER NOT NULL,
    "executedBy" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,

    CONSTRAINT "TestExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bug" (
    "id" SERIAL NOT NULL,
    "bugId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "stepsToReproduce" TEXT NOT NULL,
    "expectedBehavior" TEXT NOT NULL,
    "actualBehavior" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "priority" "BugPriority" NOT NULL,
    "status" "BugStatus" NOT NULL DEFAULT 'NEW',
    "environment" TEXT,
    "affectedVersion" TEXT,
    "fixNotes" TEXT,
    "commitHash" TEXT,
    "branchName" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "assignedToId" INTEGER,
    "testCaseId" INTEGER,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugComment" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "bugId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BugComment_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedId" TEXT,
    "relatedType" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_token_key" ON "PasswordReset"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Bug_bugId_key" ON "Bug"("bugId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- AddForeignKey
ALTER TABLE "PasswordHistory" ADD CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestExecution" ADD CONSTRAINT "TestExecution_executedBy_fkey" FOREIGN KEY ("executedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestExecution" ADD CONSTRAINT "TestExecution_testcaseId_fkey" FOREIGN KEY ("testcaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugComment" ADD CONSTRAINT "BugComment_bugId_fkey" FOREIGN KEY ("bugId") REFERENCES "Bug"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugComment" ADD CONSTRAINT "BugComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionStep" ADD CONSTRAINT "ExecutionStep_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "TestExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionStep" ADD CONSTRAINT "ExecutionStep_testCaseStepId_fkey" FOREIGN KEY ("testCaseStepId") REFERENCES "TestCaseStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCaseStep" ADD CONSTRAINT "TestCaseStep_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
