-- CreateTable
CREATE TABLE `RegistrationHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `ip_address` VARCHAR(45) NOT NULL,
    `user_agent` VARCHAR(255) NOT NULL,
    `notify_type` INTEGER NOT NULL,
    `tracking_tag_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TrackingTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `name` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `TrackingTag_name_key`(`name`),
    INDEX `TrackingTag_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RegistrationHistory` ADD CONSTRAINT `RegistrationHistory_tracking_tag_id_fkey` FOREIGN KEY (`tracking_tag_id`) REFERENCES `TrackingTag`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
