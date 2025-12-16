import { Client, Account, Users, ID } from 'node-appwrite';
import jwt from 'jsonwebtoken';

// JWT Token Configuration
const ACCESS_TOKEN_TTL = '15m';   // 15 minutes
const REFRESH_TOKEN_TTL = '7d';   // 7 days

/**
 * Generate JWT access and refresh tokens
 */
const generateTokens = (user, jwtSecret, jwtRefreshSecret) => {
    const accessToken = jwt.sign(
        {
            userId: user.$id,
            email: user.email,
            role: 'admin',
            type: 'access'
        },
        jwtSecret,
        { expiresIn: ACCESS_TOKEN_TTL }
    );

    const refreshToken = jwt.sign(
        {
            userId: user.$id,
            type: 'refresh'
        },
        jwtRefreshSecret,
        { expiresIn: REFRESH_TOKEN_TTL }
    );

    return { accessToken, refreshToken };
};

export default async ({ req, res, log, error }) => {
    if (req.method !== 'POST') {
        return res.json({ error: 'Method not allowed' }, 405);
    }

    // Check for required environment variables
    const jwtSecret = process.env.JWT_SECRET;
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!jwtSecret || !jwtRefreshSecret) {
        error('JWT_SECRET or JWT_REFRESH_SECRET not configured');
        return res.json({ error: 'Server configuration error' }, 500);
    }

    // Admin client with API key for user management
    const adminClient = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const users = new Users(adminClient);

    try {
        const body = JSON.parse(req.body || '{}');
        const { action, email, password, name, refreshToken, userId } = body;

        // ========================================
        // GET TOKENS - After client-side auth, verify admin and issue JWT
        // ========================================
        if (action === 'getTokens') {
            if (!email && !userId) {
                return res.json({ error: 'Email or userId required' }, 400);
            }

            try {
                // Get user by email or userId
                let user;
                if (userId) {
                    user = await users.get(userId);
                } else {
                    const userList = await users.list([`equal("email", "${email}")`]);
                    if (userList.total === 0) {
                        return res.json({ error: 'User not found' }, 404);
                    }
                    user = userList.users[0];
                }

                // Check if user has admin label
                const isAdmin = user.labels?.includes('admin');

                if (!isAdmin) {
                    return res.json({ error: 'Access denied - Not an admin' }, 403);
                }

                // Generate JWT tokens
                const tokens = generateTokens(user, jwtSecret, jwtRefreshSecret);

                log(`Admin tokens issued: ${user.email}`);

                return res.json({
                    success: true,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    user: {
                        id: user.$id,
                        email: user.email,
                        name: user.name,
                        role: 'admin'
                    }
                });
            } catch (authError) {
                error(`GetTokens failed: ${authError.message}`);
                return res.json({ error: 'Failed to get tokens', message: authError.message }, 500);
            }
        }

        // ========================================
        // LOGIN (Legacy) - Keep for backward compatibility
        // ========================================
        if (action === 'login') {
            // Redirect to getTokens - client-side should handle password validation now
            return res.json({
                error: 'Please use client-side authentication',
                hint: 'Login flow changed. Update your client to use session-based auth.'
            }, 400);
        }

        // ========================================
        // REFRESH - Get new access token using refresh token
        // ========================================
        if (action === 'refresh') {
            if (!refreshToken) {
                return res.json({ error: 'Refresh token required' }, 400);
            }

            try {
                // Verify the refresh token
                const decoded = jwt.verify(refreshToken, jwtRefreshSecret);

                if (decoded.type !== 'refresh') {
                    return res.json({ error: 'Invalid token type' }, 401);
                }

                // Get user to ensure they still exist and are admin
                const user = await users.get(decoded.userId);

                if (!user.labels?.includes('admin')) {
                    return res.json({ error: 'Not an admin' }, 403);
                }

                // Generate new access token only
                const newAccessToken = jwt.sign(
                    {
                        userId: user.$id,
                        email: user.email,
                        role: 'admin',
                        type: 'access'
                    },
                    jwtSecret,
                    { expiresIn: ACCESS_TOKEN_TTL }
                );

                log(`Token refresh for: ${user.email}`);

                return res.json({
                    success: true,
                    accessToken: newAccessToken
                });
            } catch (refreshError) {
                if (refreshError.name === 'TokenExpiredError') {
                    return res.json({ error: 'Refresh token expired' }, 401);
                }
                return res.json({ error: 'Invalid refresh token' }, 401);
            }
        }

        // ========================================
        // VERIFY - Validate access token
        // ========================================
        if (action === 'verify') {
            const authHeader = req.headers['authorization'] || body.accessToken;
            const token = authHeader?.startsWith('Bearer ')
                ? authHeader.substring(7)
                : authHeader;

            if (!token) {
                return res.json({ error: 'Access token required' }, 400);
            }

            try {
                const decoded = jwt.verify(token, jwtSecret);

                if (decoded.type !== 'access') {
                    return res.json({ error: 'Invalid token type' }, 401);
                }

                // Get fresh user data
                const user = await users.get(decoded.userId);

                if (!user.labels?.includes('admin')) {
                    return res.json({ error: 'Not an admin' }, 403);
                }

                return res.json({
                    success: true,
                    valid: true,
                    user: {
                        id: user.$id,
                        email: user.email,
                        name: user.name,
                        role: 'admin'
                    }
                });
            } catch (verifyError) {
                if (verifyError.name === 'TokenExpiredError') {
                    return res.json({ error: 'Token expired', expired: true }, 401);
                }
                return res.json({ error: 'Invalid token' }, 401);
            }
        }

        // ========================================
        // REGISTER - Create new admin (protected)
        // ========================================
        if (action === 'register') {
            if (!email || !password) {
                return res.json({ error: 'Email and password required' }, 400);
            }

            try {
                // Create user with Appwrite Auth
                const newUser = await users.create(
                    ID.unique(),
                    email,
                    undefined,
                    password,
                    name || 'Admin'
                );

                // Add admin label
                await users.updateLabels(newUser.$id, ['admin']);

                log(`New admin created: ${email}`);

                return res.json({
                    success: true,
                    message: 'Admin user created',
                    user: {
                        id: newUser.$id,
                        email: newUser.email,
                        name: newUser.name
                    }
                });
            } catch (createError) {
                error(`Create admin failed: ${createError.message}`);
                return res.json({
                    error: 'Failed to create admin',
                    message: createError.message
                }, 400);
            }
        }

        return res.json({
            error: 'Invalid action',
            allowed: ['login', 'verify', 'refresh', 'register']
        }, 400);

    } catch (err) {
        error(`Auth error: ${err.message}`);
        return res.json({ error: 'Authentication failed', message: err.message }, 500);
    }
};
