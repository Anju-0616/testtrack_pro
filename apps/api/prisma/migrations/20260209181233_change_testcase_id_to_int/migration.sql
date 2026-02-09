/*
  Warnings:

  - The primary key for the `TestCase` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `TestCase` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "TestCase" DROP CONSTRAINT "TestCase_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id");
