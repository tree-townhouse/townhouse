/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddUserRestriction1769858900000 {
	name = 'AddUserRestriction1769858900000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" ADD "isRestricted" boolean DEFAULT false NOT NULL`);
		await queryRunner.query(`ALTER TABLE "user" ADD "restrictedUntil" timestamp with time zone NULL`);
		await queryRunner.query(`ALTER TABLE "meta" ADD "restrictAnnouncementTitle" character varying(256) NULL`);
		await queryRunner.query(`ALTER TABLE "meta" ADD "restrictAnnouncementText" character varying(2048) NULL`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "restrictAnnouncementText"`);
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "restrictAnnouncementTitle"`);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "restrictedUntil"`);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "isRestricted"`);
	}
}
