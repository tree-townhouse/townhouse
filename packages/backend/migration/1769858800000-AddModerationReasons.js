/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddModerationReasons1769858800000 {
	name = 'AddModerationReasons1769858800000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" ADD "moderationReasons" jsonb NOT NULL DEFAULT '[]'::jsonb`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "moderationReasons"`);
	}
}
