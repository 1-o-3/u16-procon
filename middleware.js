export const config = {
    matcher: ['/admin/:path*'],
};

export default function middleware(req) {
    const basicAuth = req.headers.get('authorization');

    if (basicAuth) {
        const authValue = basicAuth.split(' ')[1];
        const [user, pwd] = atob(authValue).split(':');

        const validUser = process.env.ADMIN_USER || 'u16shizuoka';
        const validPwd = process.env.ADMIN_PASSWORD || 'u16shizuoka';

        if (user === validUser && pwd === validPwd) {
            return;
        }
    }

    return new Response('Auth required', {
        status: 401,
        headers: {
            'WWW-Authenticate': 'Basic realm="Secure Area"'
        }
    });
}
