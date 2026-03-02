/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddTargetUserIdToModerationLog1769858700000 {
	name = 'AddTargetUserIdToModerationLog1769858700000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "moderation_log" ADD "targetUserId" character varying(32) NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_moderation_log_targetUserId" ON "moderation_log" ("targetUserId")`);
		// Backfill targetUserId from info JSON for existing records
		await queryRunner.query(`UPDATE "moderation_log" SET "targetUserId" = info->>'userId' WHERE info->>'userId' IS NOT NULL`);
	}

	async down(queryRunner) {
		await queryRunner.query(`DROP INDEX "IDX_moderation_log_targetUserId"`);
		await queryRunner.query(`ALTER TABLE "moderation_log" DROP COLUMN "targetUserId"`);
	}
}
