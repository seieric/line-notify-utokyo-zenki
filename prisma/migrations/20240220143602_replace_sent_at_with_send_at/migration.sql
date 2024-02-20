/*
  Warnings:

  - You are about to drop the column `sent_at` on the `Announcement` table. All the data in the column will be lost.
  - Added the required column `send_at` to the `Announcement` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Announcement` DROP COLUMN `sent_at`,
    ADD COLUMN `send_at` DATE NOT NULL;
