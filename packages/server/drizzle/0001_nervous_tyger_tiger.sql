PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`image` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	`refreshToken` text NOT NULL,
	`refreshTokenExpiresAt` text
);
--> statement-breakpoint
INSERT INTO `__new_user`("id", "name", "email", "image", "createdAt", "updatedAt", "refreshToken", "refreshTokenExpiresAt") SELECT "id", "name", "email", "image", "createdAt", "updatedAt", "refreshToken", "refreshTokenExpiresAt" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);