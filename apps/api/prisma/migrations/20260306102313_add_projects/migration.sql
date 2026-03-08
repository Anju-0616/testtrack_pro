/*
  Warnings:

  - Added the required column `projectId` to the `Bug` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `TestCase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `projectId` to the `TestRun` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'MEMBER');

-- AlterTable
ALTER TABLE "Bug" ADD COLUMN     "projectId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "TestCase" ADD COLUMN     "projectId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "TestRun" ADD COLUMN     "projectId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "key" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_key_key" ON "Project"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "Bug_projectId_idx" ON "Bug"("projectId");

-- CreateIndex
CREATE INDEX "TestCase_projectId_idx" ON "TestCase"("projectId");

-- CreateIndex
CREATE INDEX "TestRun_projectId_idx" ON "TestRun"("projectId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bug" ADD CONSTRAINT "Bug_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
