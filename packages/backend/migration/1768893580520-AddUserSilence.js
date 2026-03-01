/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddUserSilence1768893580520 {
	name = 'AddUserSilence1768893580520'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" ADD "isSilenced" boolean DEFAULT false NOT NULL`);
		await queryRunner.query(`ALTER TABLE "user" ADD "silencedUntil" timestamp with time zone NULL`);
		await queryRunner.query(`ALTER TABLE "meta" ADD "silenceAnnouncementTitle" character varying(256) NULL`);
		await queryRunner.query(`ALTER TABLE "meta" ADD "silenceAnnouncementText" character varying(2048) NULL`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "silenceAnnouncementText"`);
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "silenceAnnouncementTitle"`);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "silencedUntil"`);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isSilenced"`);
	}
}
