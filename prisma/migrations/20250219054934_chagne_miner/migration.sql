-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "profile_picture" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "blood_group" TEXT;
