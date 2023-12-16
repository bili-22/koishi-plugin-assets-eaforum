import request from 'superagent';

export async function eaForumAuth(access_token: string, id_token: string) { // eslint-disable-line @typescript-eslint/naming-convention
    const SSO_URL = `https://help.ea.com/sso/login?idToken=${id_token}&accessToken=${access_token}`;

    const { text } = await request
        .get(SSO_URL)
        .set('Referer', 'https://answers.ea.com/')
        .set('Accept', 'text/html; charset=UTF-8');
    const lithiumSSOKey: string = JSON.parse(text).lithiumSSOKey;

    const AUTH_URL = `https://answers.ea.com/ea/sso?sso_value=${encodeURIComponent(lithiumSSOKey)}&dest_url=https://answers.ea.com/t5/Answer-HQ-English/ct-p/AHQ-English`;
    const response = await request
        .get(AUTH_URL)
        .redirects(0)
        .ok((res) => res.status === 302);

    const cookies: Record<string, string> = Object.fromEntries(((response.headers['set-cookie'] || response.headers['Set-Cookie'] || []) as unknown as string[]).map((item) => item.split(';')[0].split('=')));

    return `LiSESSIONID=${cookies['LiSESSIONID']}; `
    + `!lithiumSSO=${cookies['!lithiumSSO']}; `
    + `LithiumUserInfo=${cookies['LithiumUserInfo']}; `
    + `LithiumUserSecure=${cookies['LithiumUserSecure']}`;
}
