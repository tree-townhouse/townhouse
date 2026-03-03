/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { PrimaryColumn, Entity, Index, JoinColumn, Column, ManyToOne } from 'typeorm';
import { id } from './util/id.js';
import { MiUser } from './User.js';
import { MiChannel } from './Channel.js';

export type ChannelModerationLogType =
	| 'deleteNote'
	| 'pinNote'
	| 'unpinNote'
	| 'addModerator'
	| 'removeModerator'
	| 'banUser'
	| 'unbanUser';

@Entity('channel_moderation_log')
export class MiChannelModerationLog {
	@PrimaryColumn(id())
	public id: string;

	@Index()
	@Column({
		...id(),
	})
	public channelId: MiChannel['id'];

	@ManyToOne(type => MiChannel, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public channel: MiChannel | null;

	@Index()
	@Column({
		...id(),
		comment: 'The user who performed the action.',
	})
	public userId: MiUser['id'];

	@ManyToOne(type => MiUser, {
		onDelete: 'CASCADE',
	})
	@JoinColumn()
	public user: MiUser | null;

	@Column('varchar', {
		length: 64,
		comment: 'The type of moderation action.',
	})
	public type: ChannelModerationLogType;

	@Column('jsonb', {
		default: {},
		comment: 'Additional info about the action.',
	})
	public info: Record<string, any>;
}
