/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddUserWarning1769858400000 {
	name = 'AddUserWarning1769858400000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" ADD "warningCount" integer DEFAULT 0 NOT NULL`);
		await queryRunner.query(`ALTER TABLE "meta" ADD "warningAnnouncementTitle" character varying(256) NULL`);
		await queryRunner.query(`ALTER TABLE "meta" ADD "warningAnnouncementText" character varying(2048) NULL`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "warningAnnouncementText"`);
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "warningAnnouncementTitle"`);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "warningCount"`);
	}
}
