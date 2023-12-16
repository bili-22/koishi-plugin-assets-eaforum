import request from 'superagent';

export function getImageType(file: Buffer) {
    const magic = file.subarray(0, 4).toString('hex');
    switch (magic) {
        case '89504e47':
            return 'png';
        case 'ffd8ffe0':
            return 'jpg';
        default:
            return null;
    }
}

export async function uploadImage(
    cookies: string,
    image: Buffer,
    filename?: string,
) {
    filename ||= `${new Date().toISOString()}.${getImageType(image)}`;
    const token = await getUploadToken(cookies);
    const response = await request
        .post(
            'https://answers.ea.com/t5/media/v3/imageuploaderpopuppage.imageupload:uploadimageaction',
        )
        .set('Cookie', cookies)
        .type('form')
        .field('previewSize', 'medium')
        .attach('Filedata', image, filename);
    const { AWSALB }: Record<string, string> = Object.fromEntries(
        (response.headers['set-cookie'] as unknown as string[]).map((cookie) =>
            cookie.split(';')[0].split('=')),
    );
    const id: string = JSON.parse(unescape(response.text).slice(32, -21)).response.parameters[0].key;
    const response2 = await request
        .post(
            'https://answers.ea.com/t5/media/v3/imageuploaderpopuppage.imageupload:saveimagetogallery',
        )
        .set('Lithium-Ajax-Request', 'true')
        .set('Cookie', `${cookies}; AWSALB=${AWSALB}; AWSALBCORS=${AWSALB}`)
        .type('form')
        .field('id', id)
        .field('title', filename)
        .field('description', '')
        .field('makePrivate', 'false')
        .field('triggerEvent', 'LITHIUM:saveImageToGallery')
        .field('eventTargetId', 'imageFeedback')
        .field('ignore_combine_and_minify', 'true')
        .field('lia-action-token', token)
        .field('lia-action-token-id', 'ajax');
    if (!response2?.body?.response.parameters.length) throw new Error('上传失败');
    return `https://answers.ea.com/t5/image/serverpage/image-id/${response2.body.response.parameters[0].imageId}`;
}

async function getUploadToken(cookies: string) {
    const POST_URL = 'https://answers.ea.com/t5/media/imageuploaderpopuppage/board-id/battlefield-general-discussion-en/post-message-type/post';
    const { text: html, status } = await request
        .get(POST_URL)
        .set('Cookie', cookies)
        .redirects(0);
    if (status !== 200) {
        throw new Error('Cookie失效');
    }
    if (!html.includes('LITHIUM:saveImageToGallery')) {
        throw new Error('账号没有发图权限');
    }
    const { token } = JSON.parse(
        html.match(/.*LITHIUM:saveImageToGallery.*/)![0].slice(20, -2),
    );
    return token as string;
}

function unescape(source: string) {
    return source
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, code) =>
            (code === '38' ? _ : String.fromCharCode(+code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
            (code === '26' ? _ : String.fromCharCode(parseInt(code, 16))))
        .replace(/&(amp|#38|#x26);/g, '&');
}
