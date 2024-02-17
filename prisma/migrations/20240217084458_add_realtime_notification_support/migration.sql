-- AlterTable
ALTER TABLE `line_notify_tokens` ADD COLUMN `notify_cycle` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `NewsItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `link` VARCHAR(255) NOT NULL,
    `type` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
