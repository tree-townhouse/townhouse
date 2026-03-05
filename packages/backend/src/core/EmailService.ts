/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as nodemailer from 'nodemailer';
import juice from 'juice';
import { Inject, Injectable } from '@nestjs/common';
import { validate as validateEmail } from 'deep-email-validator';
import { UtilityService } from '@/core/UtilityService.js';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type Logger from '@/logger.js';
import type { MiMeta, UserProfilesRepository } from '@/models/_.js';
import { LoggerService } from '@/core/LoggerService.js';
import { bindThis } from '@/decorators.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';

@Injectable()
export class EmailService {
	private logger: Logger;

	constructor(
		@Inject(DI.config)
		private config: Config,

		@Inject(DI.meta)
		private meta: MiMeta,

		@Inject(DI.userProfilesRepository)
		private userProfilesRepository: UserProfilesRepository,

		private loggerService: LoggerService,
		private utilityService: UtilityService,
		private httpRequestService: HttpRequestService,
	) {
		this.logger = this.loggerService.getLogger('email');
	}

	@bindThis
	public async sendEmail(to: string, subject: string, html: string, text: string, opts?: { addPrefix?: boolean; displayTitle?: string }) {
		if (!this.meta.enableEmail) return;

		const serverName = this.meta.name ?? this.config.host;
		const prefixedSubject = (opts?.addPrefix !== false) ? `[${serverName}] ${subject}` : subject;
		const bodyTitle = opts?.displayTitle ?? subject;
		const iconUrl = `${this.config.url}/static-assets/mi-white.png`;
		const emailSettingUrl = `${this.config.url}/settings/email`;

		const enableAuth = this.meta.smtpUser != null && this.meta.smtpUser !== '';

		const transporter = nodemailer.createTransport({
			host: this.meta.smtpHost,
			port: this.meta.smtpPort,
			secure: this.meta.smtpSecure,
			ignoreTLS: !enableAuth,
			proxy: this.config.proxySmtp,
			auth: enableAuth ? {
				user: this.meta.smtpUser,
				pass: this.meta.smtpPass,
			} : undefined,
		} as any);

		const htmlContent = `<!doctype html>
<html>
	<head>
		<meta charset="utf-8">
		<title>${ prefixedSubject }</title>
		<style>
			html {
				background: #f5f5f5;
			}

			body {
				padding: 0;
				margin: 0;
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
				font-size: 14px;
				line-height: 1.7;
				color: #333;
			}

			a {
				text-decoration: none;
				color: #E67E22;
			}
			a:hover {
				text-decoration: underline;
			}

			main {
				max-width: 600px;
				margin: 32px auto 0 auto;
				background: #fff;
				border-radius: 12px;
				box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
				overflow: hidden;
			}
				main > header {
					padding: 20px 32px;
					background: #E67E22;
				}
					main > header > img {
						max-width: 32px;
						max-height: 32px;
						vertical-align: middle;
						background: #fff;
						border-radius: 50%;
						padding: 3px;
					}
					main > header > .header-text {
						margin-left: 10px;
						font-size: 15px;
						font-weight: 700;
						color: #fff;
						vertical-align: middle;
					}
				main > article {
					padding: 36px 32px;
				}
					main > article > h1 {
						margin: 0 0 24px 0;
						font-size: 18px;
						font-weight: 700;
						color: #E67E22;
						line-height: 1.5;
						text-align: left;
					}
					main > article > div {
						color: #555;
						line-height: 1.8;
						font-size: 14px;
					}
				main > footer {
					padding: 20px 32px;
					border-top: solid 1px #f0f0f0;
					text-align: center;
				}
					main > footer > a {
						display: inline-block;
						color: #E67E22;
						font-size: 13px;
						padding: 6px 16px;
						border: 1px solid #E67E22;
						border-radius: 20px;
						transition: background 0.2s;
					}

			nav {
				box-sizing: border-box;
				max-width: 600px;
				margin: 20px auto 40px auto;
				padding: 0 32px;
				text-align: center;
			}
				nav > .copyright {
					color: #999;
					font-size: 12px;
				}
				nav > .host-link {
					display: block;
					margin-top: 4px;
					color: #999;
					font-size: 12px;
				}
		</style>
	</head>
	<body>
		<main>
			<header>
				<img src="${ this.meta.logoImageUrl ?? this.meta.iconUrl ?? iconUrl }"/>
				<span class="header-text">${ this.meta.name ?? this.config.host }</span>
			</header>
			<article>
				<h1>${ bodyTitle }</h1>
				<div>${ html }</div>
			</article>
			<footer>
				<a href="${ emailSettingUrl }">Email setting</a>
			</footer>
		</main>
		<nav>
			<span class="copyright">&copy; ${ this.meta.name ?? this.config.host }</span>
			<a class="host-link" href="${ this.config.url }">${ this.config.host }</a>
		</nav>
	</body>
</html>`;

		const inlinedHtml = juice(htmlContent);

		try {
			// TODO: htmlサニタイズ
			const info = await transporter.sendMail({
				from: this.meta.name ? {
					name: this.meta.name,
					address: this.meta.email!,
				} : this.meta.email!,
				to: to,
				subject: prefixedSubject,
				text: text,
				html: inlinedHtml,
			});

			this.logger.info(`Message sent: ${info.messageId}`);
		} catch (err) {
			this.logger.error(err as Error);
			throw err;
		}
	}

	@bindThis
	public async validateEmailForAccount(emailAddress: string): Promise<{
		available: boolean;
		reason: null | 'used' | 'format' | 'disposable' | 'mx' | 'smtp' | 'banned' | 'network' | 'blacklist';
	}> {
		if (!this.utilityService.validateEmailFormat(emailAddress)) {
			return {
				available: false,
				reason: 'format',
			};
		}

		const exist = await this.userProfilesRepository.countBy({
			emailVerified: true,
			email: emailAddress,
		});

		if (exist !== 0) {
			return {
				available: false,
				reason: 'used',
			};
		}

		let validated: {
			valid: boolean,
			reason?: string | null,
		} = { valid: true, reason: null };

		if (this.meta.enableActiveEmailValidation) {
			if (this.meta.enableVerifymailApi && this.meta.verifymailAuthKey != null) {
				validated = await this.verifyMail(emailAddress, this.meta.verifymailAuthKey);
			} else if (this.meta.enableTruemailApi && this.meta.truemailInstance && this.meta.truemailAuthKey != null) {
				validated = await this.trueMail(this.meta.truemailInstance, emailAddress, this.meta.truemailAuthKey);
			} else {
				validated = await validateEmail({
					email: emailAddress,
					validateRegex: true,
					validateMx: true,
					validateTypo: false, // TLDを見ているみたいだけどclubとか弾かれるので
					validateDisposable: true, // 捨てアドかどうかチェック
					validateSMTP: false, // 日本だと25ポートが殆どのプロバイダーで塞がれていてタイムアウトになるので
				});
			}
		}

		if (!validated.valid) {
			const formatReason: Record<string, 'format' | 'disposable' | 'mx' | 'smtp' | 'network' | 'blacklist' | undefined> = {
				regex: 'format',
				disposable: 'disposable',
				mx: 'mx',
				smtp: 'smtp',
				network: 'network',
				blacklist: 'blacklist',
			};

			return {
				available: false,
				reason: validated.reason ? formatReason[validated.reason] ?? null : null,
			};
		}

		const emailDomain: string = emailAddress.split('@')[1];
		const isBanned = this.utilityService.isBlockedHost(this.meta.bannedEmailDomains, emailDomain);

		if (isBanned) {
			return {
				available: false,
				reason: 'banned',
			};
		}

		return {
			available: true,
			reason: null,
		};
	}

	private async verifyMail(emailAddress: string, verifymailAuthKey: string): Promise<{
		valid: boolean;
		reason: 'used' | 'format' | 'disposable' | 'mx' | 'smtp' | null;
	}> {
		const endpoint = 'https://verifymail.io/api/' + emailAddress + '?key=' + verifymailAuthKey;
		const res = await this.httpRequestService.send(endpoint, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json, */*',
			},
		});

		const json = (await res.json()) as Partial<{
			message: string;
			block: boolean;
			catch_all: boolean;
			deliverable_email: boolean;
			disposable: boolean;
			domain: string;
			email_address: string;
			email_provider: string;
			mx: boolean;
			mx_fallback: boolean;
			mx_host: string[];
			mx_ip: string[];
			mx_priority: { [key: string]: number };
			privacy: boolean;
			related_domains: string[];
		}>;

		/* api error: when there is only one `message` attribute in the returned result */
		if (Object.keys(json).length === 1 && Reflect.has(json, 'message')) {
			return {
				valid: false,
				reason: null,
			};
		}
		if (json.email_address === undefined) {
			return {
				valid: false,
				reason: 'format',
			};
		}
		if (json.deliverable_email !== undefined && !json.deliverable_email) {
			return {
				valid: false,
				reason: 'smtp',
			};
		}
		if (json.disposable) {
			return {
				valid: false,
				reason: 'disposable',
			};
		}
		if (json.mx !== undefined && !json.mx) {
			return {
				valid: false,
				reason: 'mx',
			};
		}

		return {
			valid: true,
			reason: null,
		};
	}

	private async trueMail<T>(truemailInstance: string, emailAddress: string, truemailAuthKey: string): Promise<{
		valid: boolean;
		reason: 'used' | 'format' | 'blacklist' | 'mx' | 'smtp' | 'network' | T | null;
	}> {
		const endpoint = truemailInstance + '?email=' + emailAddress;
		try {
			const res = await this.httpRequestService.send(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json',
					Authorization: truemailAuthKey,
				},
				isLocalAddressAllowed: true,
			});

			const json = (await res.json()) as {
				email: string;
				success: boolean;
				error?: string;
				errors?: {
					list_match?: string;
					regex?: string;
					mx?: string;
					smtp?: string;
				} | null;
			};

			if (json.email === undefined || json.errors?.regex) {
				return {
					valid: false,
					reason: 'format',
				};
			}
			if (json.errors?.smtp) {
				return {
					valid: false,
					reason: 'smtp',
				};
			}
			if (json.errors?.mx) {
				return {
					valid: false,
					reason: 'mx',
				};
			}
			if (!json.success) {
				return {
					valid: false,
					reason: json.errors?.list_match as T || 'blacklist',
				};
			}

			return {
				valid: true,
				reason: null,
			};
		} catch (error) {
			return {
				valid: false,
				reason: 'network',
			};
		}
	}
}
