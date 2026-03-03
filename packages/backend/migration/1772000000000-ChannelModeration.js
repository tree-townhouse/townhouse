/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class ChannelModeration1772000000000 {
	name = 'ChannelModeration1772000000000'

	/**
	 * @param {import('typeorm').QueryRunner} queryRunner
	 */
	async up(queryRunner) {
		// 1. Create channel_moderator table
		await queryRunner.query(`CREATE TABLE "channel_moderator" ("id" character varying(32) NOT NULL, "channelId" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'pending', CONSTRAINT "PK_channel_moderator_id" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_moderator_channelId" ON "channel_moderator" ("channelId")`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_moderator_userId" ON "channel_moderator" ("userId")`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_channel_moderator_channelId_userId" ON "channel_moderator" ("channelId", "userId")`);
		await queryRunner.query(`COMMENT ON COLUMN "channel_moderator"."status" IS 'Status of the moderator invitation: pending, accepted, rejected'`);
		await queryRunner.query(`ALTER TABLE "channel_moderator" ADD CONSTRAINT "FK_channel_moderator_channelId" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "channel_moderator" ADD CONSTRAINT "FK_channel_moderator_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

		// 2. Create channel_ban table
		await queryRunner.query(`CREATE TABLE "channel_ban" ("id" character varying(32) NOT NULL, "channelId" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "bannedById" character varying(32) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_channel_ban_id" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_ban_channelId" ON "channel_ban" ("channelId")`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_ban_userId" ON "channel_ban" ("userId")`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_ban_bannedById" ON "channel_ban" ("bannedById")`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_channel_ban_channelId_userId" ON "channel_ban" ("channelId", "userId")`);
		await queryRunner.query(`COMMENT ON COLUMN "channel_ban"."bannedById" IS 'The user ID who banned this user.'`);
		await queryRunner.query(`COMMENT ON COLUMN "channel_ban"."expiresAt" IS 'When the ban expires. Null means permanent.'`);
		await queryRunner.query(`ALTER TABLE "channel_ban" ADD CONSTRAINT "FK_channel_ban_channelId" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "channel_ban" ADD CONSTRAINT "FK_channel_ban_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "channel_ban" ADD CONSTRAINT "FK_channel_ban_bannedById" FOREIGN KEY ("bannedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

		// 3. Delete all archived channels and their related data
		// First delete notes in archived channels
		await queryRunner.query(`DELETE FROM "note" WHERE "channelId" IN (SELECT "id" FROM "channel" WHERE "isArchived" = true)`);
		// Delete the archived channels themselves (cascade will clean up followings, favorites, muting)
		await queryRunner.query(`DELETE FROM "channel" WHERE "isArchived" = true`);

		// 4. Add isApproved column to channel, then drop isArchived
		await queryRunner.query(`ALTER TABLE "channel" ADD "isApproved" boolean NOT NULL DEFAULT true`);
		await queryRunner.query(`COMMENT ON COLUMN "channel"."isApproved" IS 'Whether the channel is approved (relevant when requireChannelApproval is enabled).'`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_isApproved" ON "channel" ("isApproved")`);
		await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "isArchived"`);

		// 5. Add requireChannelApproval to meta
		await queryRunner.query(`ALTER TABLE "meta" ADD "requireChannelApproval" boolean NOT NULL DEFAULT false`);
		await queryRunner.query(`COMMENT ON COLUMN "meta"."requireChannelApproval" IS 'Whether channel creation requires approval from server admin.'`);

		// 6. Add unique constraint on channel name
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_channel_name_unique" ON "channel" ("name")`);

		// 7. Create channel_moderation_log table
		await queryRunner.query(`CREATE TABLE "channel_moderation_log" ("id" character varying(32) NOT NULL, "channelId" character varying(32) NOT NULL, "userId" character varying(32) NOT NULL, "type" character varying(64) NOT NULL, "info" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_channel_moderation_log_id" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_moderation_log_channelId" ON "channel_moderation_log" ("channelId")`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_moderation_log_userId" ON "channel_moderation_log" ("userId")`);
		await queryRunner.query(`COMMENT ON COLUMN "channel_moderation_log"."userId" IS 'The user who performed the action.'`);
		await queryRunner.query(`COMMENT ON COLUMN "channel_moderation_log"."type" IS 'The type of moderation action.'`);
		await queryRunner.query(`COMMENT ON COLUMN "channel_moderation_log"."info" IS 'Additional info about the action.'`);
		await queryRunner.query(`ALTER TABLE "channel_moderation_log" ADD CONSTRAINT "FK_channel_moderation_log_channelId" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "channel_moderation_log" ADD CONSTRAINT "FK_channel_moderation_log_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	/**
	 * @param {import('typeorm').QueryRunner} queryRunner
	 */
	async down(queryRunner) {
		// Reverse: drop channel_moderation_log table
		await queryRunner.query(`ALTER TABLE "channel_moderation_log" DROP CONSTRAINT "FK_channel_moderation_log_userId"`);
		await queryRunner.query(`ALTER TABLE "channel_moderation_log" DROP CONSTRAINT "FK_channel_moderation_log_channelId"`);
		await queryRunner.query(`DROP TABLE "channel_moderation_log"`);

		// Reverse: remove requireChannelApproval from meta
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "requireChannelApproval"`);

		// Reverse: drop unique constraint on channel name
		await queryRunner.query(`DROP INDEX "IDX_channel_name_unique"`);

		// Reverse: add isArchived back, drop isApproved
		await queryRunner.query(`ALTER TABLE "channel" ADD "isArchived" boolean NOT NULL DEFAULT false`);
		await queryRunner.query(`CREATE INDEX "IDX_channel_isArchived" ON "channel" ("isArchived")`);
		await queryRunner.query(`DROP INDEX "IDX_channel_isApproved"`);
		await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "isApproved"`);

		// Reverse: drop channel_ban table
		await queryRunner.query(`ALTER TABLE "channel_ban" DROP CONSTRAINT "FK_channel_ban_bannedById"`);
		await queryRunner.query(`ALTER TABLE "channel_ban" DROP CONSTRAINT "FK_channel_ban_userId"`);
		await queryRunner.query(`ALTER TABLE "channel_ban" DROP CONSTRAINT "FK_channel_ban_channelId"`);
		await queryRunner.query(`DROP TABLE "channel_ban"`);

		// Reverse: drop channel_moderator table
		await queryRunner.query(`ALTER TABLE "channel_moderator" DROP CONSTRAINT "FK_channel_moderator_userId"`);
		await queryRunner.query(`ALTER TABLE "channel_moderator" DROP CONSTRAINT "FK_channel_moderator_channelId"`);
		await queryRunner.query(`DROP TABLE "channel_moderator"`);
	}
}
