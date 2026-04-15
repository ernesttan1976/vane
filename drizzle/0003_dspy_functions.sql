CREATE TABLE `dspy_functions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`inputSchemaJson` text NOT NULL,
	`outputSchemaJson` text NOT NULL,
	`moduleType` text NOT NULL,
	`instructions` text NOT NULL,
	`userPromptTemplate` text NOT NULL,
	`formatterType` text NOT NULL,
	`safetyJson` text DEFAULT '{}' ,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dspy_functions_name_unique` ON `dspy_functions` (`name`);
