/*
 * SPDX-FileCopyrightText: noridev and cherrypick-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export class IsBlinded1768893580519 {
    name = 'IsBlinded1768893580519'

    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "note" ADD "isBlinded" boolean DEFAULT false NOT NULL`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "note" DROP COLUMN "isBlinded"`);
    }
}
