import Assets from '@koishijs/assets';
import { Context, Schema } from 'koishi';
import {} from 'koishi-plugin-ea';
import { eaForumAuth } from './login';
import { getImageType, uploadImage } from './upload';

class EAForumAssets extends Assets<EAForumAssets.Config> {
    static inject = {
        optional: ['ea'],
    };

    protected remote: boolean;
    protected account: string;
    protected cookie: string;
    protected timeout: NodeJS.Timeout;
    protected wait: Promise<void>;

    constructor(ctx: Context, config: EAForumAssets.Config) {
        super(ctx, config);
        this.remote = config.remote;
        this.account = config.account;

        if (!config.remote) {
            this.wait = new Promise<void>((resolve) => {
                ctx.inject(['ea'], async () => {
                    await this.auth();
                    this.timeout = setInterval(() => this.auth(), 3 * 3600 * 1000);
                    resolve();
                });
            });
        }
    }

    protected stop() {
        clearTimeout(this.timeout);
    }

    protected async auth() {
        const url = await this.ctx.ea.auth({
            client_id: 'help-ea',
            response_type: 'token id_token',
            nonce: 'nonce',
            redirect_uri: 'https://answers.ea.com',
        }, +this.account);
        this.cookie = await eaForumAuth(url.match(/access_token=(.*?)&/)[1]!, url.match(/id_token=(.*?)&/)[1]!);
        this.logger.info('EA Forum cookie updated');
    }

    async upload(url: string, file: string) {
        const { buffer, filename } = await this.analyze(url, file);
        const type = getImageType(buffer);
        if (!type) throw new Error('不支持的图片格式');
        if (this.remote) {
            const url = await this.ctx.http.post('https://ea-img.bili22.me/upload', buffer, { headers: { 'Content-Type': type === 'png' ? 'image/png' : 'image/jpeg' } });
            return url;
        }
        if (!this.ctx.ea) throw new Error('EA插件未启用');
        await this.wait;
        return uploadImage(this.cookie, buffer, filename.endsWith(`.${type}`) ? filename : `${filename}.${type}`);
    }

    async stats() {
        return { assetSize: null };
    }
}

namespace EAForumAssets {
    export interface Config extends Assets.Config {
        remote: boolean;
        account?: string;
    }

    export const Config: Schema<Config> = Schema.intersect([
        Schema.intersect([
            Schema.object({
                remote: Schema.boolean().default(false).description('是否使用公共服务(https://ea-img.bili22.me/upload)'),
            }),
            Schema.union([
                Schema.object({
                    remote: Schema.const(false),
                    account: Schema.string().description('需要使用的EA账号的PersonaId, 留空则使用默认账号'),
                }),
                Schema.object({
                    remote: Schema.const(true).required(),
                }),
            ]),
        ]),
        Assets.Config,
    ]);
}

export default EAForumAssets;
