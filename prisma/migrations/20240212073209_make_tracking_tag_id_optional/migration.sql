-- DropForeignKey
ALTER TABLE `RegistrationHistory` DROP FOREIGN KEY `RegistrationHistory_tracking_tag_id_fkey`;

-- AlterTable
ALTER TABLE `RegistrationHistory` MODIFY `tracking_tag_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `RegistrationHistory` ADD CONSTRAINT `RegistrationHistory_tracking_tag_id_fkey` FOREIGN KEY (`tracking_tag_id`) REFERENCES `TrackingTag`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
