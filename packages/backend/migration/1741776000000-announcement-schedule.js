/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AnnouncementSchedule1741776000000 {
	name = 'AnnouncementSchedule1741776000000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "announcement" ADD "publishAt" TIMESTAMP WITH TIME ZONE`);
		await queryRunner.query(`ALTER TABLE "announcement" ADD "closesAt" TIMESTAMP WITH TIME ZONE`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "announcement" DROP COLUMN "closesAt"`);
		await queryRunner.query(`ALTER TABLE "announcement" DROP COLUMN "publishAt"`);
	}
}
