/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddSuspendMessage1787443200000 {
	name = 'AddSuspendMessage1787443200000'

	async up(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" ADD "suspendMessage" character varying(2048) NULL`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "suspendMessage"`);
	}
}
