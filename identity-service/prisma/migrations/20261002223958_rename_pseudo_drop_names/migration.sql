-- AlterTable
ALTER TABLE "User" DROP COLUMN "firstName",
DROP COLUMN "lastName";

-- RenameColumn
ALTER TABLE "User" RENAME COLUMN "pseudo" TO "username";
ALTER TABLE "User" RENAME COLUMN "pseudoNormalized" TO "usernameNormalized";

-- RenameIndex
ALTER INDEX "User_pseudoNormalized_key" RENAME TO "User_usernameNormalized_key";
