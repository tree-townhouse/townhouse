/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddSuspendAnnouncement1769858500000 {
	name = 'AddSuspendAnnouncement1769858500000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" ADD "suspendAnnouncementTitle" character varying(256) NULL`);
		await queryRunner.query(`ALTER TABLE "meta" ADD "suspendAnnouncementText" character varying(2048) NULL`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "suspendAnnouncementText"`);
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN "suspendAnnouncementTitle"`);
	}
}
