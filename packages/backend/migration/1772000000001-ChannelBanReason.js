/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class ChannelBanReason1772000000001 {
	name = 'ChannelBanReason1772000000001'

	/**
	 * @param {import('typeorm').QueryRunner} queryRunner
	 */
	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "channel_ban" ADD "reason" character varying(512) NOT NULL DEFAULT ''`);
		await queryRunner.query(`COMMENT ON COLUMN "channel_ban"."reason" IS 'The reason for the ban.'`);
	}

	/**
	 * @param {import('typeorm').QueryRunner} queryRunner
	 */
	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "channel_ban" DROP COLUMN "reason"`);
	}
}
