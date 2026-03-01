/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class AddSuspendReasonColumn1769858600000 {
	name = 'AddSuspendReasonColumn1769858600000'

	async up(queryRunner) {
		await queryRunner.query(`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'suspendReason') THEN
				ALTER TABLE "user" ADD "suspendReason" character varying(512) NULL;
			END IF;
		END $$`);
		await queryRunner.query(`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meta' AND column_name = 'suspendAnnouncementTitle') THEN
				ALTER TABLE "meta" ADD "suspendAnnouncementTitle" character varying(256) NULL;
			END IF;
		END $$`);
		await queryRunner.query(`DO $$ BEGIN
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meta' AND column_name = 'suspendAnnouncementText') THEN
				ALTER TABLE "meta" ADD "suspendAnnouncementText" character varying(2048) NULL;
			END IF;
		END $$`);
	}

	async down(queryRunner) {
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "suspendAnnouncementText"`);
		await queryRunner.query(`ALTER TABLE "meta" DROP COLUMN IF EXISTS "suspendAnnouncementTitle"`);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "suspendReason"`);
	}
}
