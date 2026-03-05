/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AnnouncementClosedOnly1772100000000 {
	name = 'AnnouncementClosedOnly1772100000000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "announcement" ADD "closedOnly" boolean NOT NULL DEFAULT false`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "announcement" DROP COLUMN "closedOnly"`);
	}
}
