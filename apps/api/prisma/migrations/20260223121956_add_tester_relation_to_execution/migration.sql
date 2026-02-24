-- AddForeignKey
ALTER TABLE "TestExecution" ADD CONSTRAINT "TestExecution_executedBy_fkey" FOREIGN KEY ("executedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
