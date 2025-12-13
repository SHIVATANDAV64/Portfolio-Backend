import { Client, Databases, Query } from 'node-appwrite';

// Simple JWT implementation (for production, consider using a proper JWT library)
const base64UrlEncode = (str) => {
    return Buffer.from(str).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};

const createJWT = (payload, secret, expiresIn = 86400) => {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);

    const tokenPayload = {
        ...payload,
        iat: now,
        exp: now + expiresIn
    };

    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(tokenPayload));

    // Simple signature (for production, use crypto HMAC)
    const crypto = await import('crypto');
    const signature = crypto.createHmac('sha256', secret)
        .update(`${headerEncoded}.${payloadEncoded}`)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

    return `${headerEncoded}.${payloadEncoded}.${signature}`;
};

const verifyJWT = async (token, secret) => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [headerEncoded, payloadEncoded, signature] = parts;

        const crypto = await import('crypto');
        const expectedSignature = crypto.createHmac('sha256', secret)
            .update(`${headerEncoded}.${payloadEncoded}`)
            .digest('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');

        if (signature !== expectedSignature) return null;

        const payload = JSON.parse(Buffer.from(payloadEncoded, 'base64').toString());

        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null; // Token expired
        }

        return payload;
    } catch {
        return null;
    }
};

export default async ({ req, res, log, error }) => {
    if (req.method !== 'POST') {
        return res.json({ error: 'Method not allowed' }, 405);
    }

    const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const databaseId = process.env.DATABASE_ID;
    const jwtSecret = process.env.JWT_SECRET;

    try {
        const body = JSON.parse(req.body || '{}');
        const { action, email, password, token } = body;

        // Login action
        if (action === 'login') {
            if (!email || !password) {
                return res.json({ error: 'Email and password required' }, 400);
            }

            // Query admin users collection
            const admins = await databases.listDocuments(
                databaseId,
                'admin_users',
                [Query.equal('email', email)]
            );

            if (admins.total === 0) {
                return res.json({ error: 'Invalid credentials' }, 401);
            }

            const admin = admins.documents[0];

            // Compare password hash (in production, use bcrypt)
            const crypto = await import('crypto');
            const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

            if (admin.password_hash !== hashedPassword) {
                return res.json({ error: 'Invalid credentials' }, 401);
            }

            log(`Admin login: ${email}`);

            // Generate JWT token
            const jwtToken = await createJWT(
                { userId: admin.$id, email: admin.email, role: 'admin' },
                jwtSecret,
                86400 // 24 hours
            );

            return res.json({
                success: true,
                token: jwtToken,
                user: {
                    id: admin.$id,
                    email: admin.email,
                    name: admin.name
                }
            });
        }

        // Verify token action
        if (action === 'verify') {
            if (!token) {
                return res.json({ error: 'Token required' }, 400);
            }

            const payload = await verifyJWT(token, jwtSecret);

            if (!payload) {
                return res.json({ error: 'Invalid or expired token' }, 401);
            }

            return res.json({
                success: true,
                valid: true,
                user: {
                    id: payload.userId,
                    email: payload.email,
                    role: payload.role
                }
            });
        }

        // Refresh token action
        if (action === 'refresh') {
            if (!token) {
                return res.json({ error: 'Token required' }, 400);
            }

            const payload = await verifyJWT(token, jwtSecret);

            if (!payload) {
                return res.json({ error: 'Invalid token' }, 401);
            }

            // Generate new token
            const newToken = await createJWT(
                { userId: payload.userId, email: payload.email, role: payload.role },
                jwtSecret,
                86400
            );

            return res.json({
                success: true,
                token: newToken
            });
        }

        return res.json({ error: 'Invalid action' }, 400);
    } catch (err) {
        error(`Auth error: ${err.message}`);
        return res.json({ error: 'Authentication failed', message: err.message }, 500);
    }
};
