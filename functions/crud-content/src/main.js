import { Client, Databases, Users, ID, Query, Storage } from 'node-appwrite';
import jwt from 'jsonwebtoken';

// Collections that CMS can manage
const MANAGED_COLLECTIONS = [
    'about',
    'skills',
    'projects',
    'experience',
    'testimonials',
    'services',
    'social_links',
    'hero',
    'messages'
];

/**
 * Verify JWT access token
 */
const verifyAccessToken = (token, jwtSecret) => {
    try {
        const decoded = jwt.verify(token, jwtSecret);
        if (decoded.type !== 'access') {
            return { valid: false, error: 'Invalid token type' };
        }
        return { valid: true, userId: decoded.userId, email: decoded.email };
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return { valid: false, error: 'Token expired', expired: true };
        }
        return { valid: false, error: 'Invalid token' };
    }
};

export default async ({ req, res, log, error }) => {
    // Check for JWT secret
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        error('JWT_SECRET not configured');
        return res.json({ error: 'Server configuration error' }, 500);
    }

    const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const users = new Users(client);
    const storage = new Storage(client);
    const databaseId = process.env.DATABASE_ID;
    const storageBucketId = process.env.STORAGE_BUCKET_ID;

    try {
        const body = JSON.parse(req.body || '{}');
        const { action, collection, documentId, data, accessToken } = body;

        // ========================================
        // JWT Authentication
        // ========================================
        if (!accessToken) {
            return res.json({ error: 'Access token required' }, 401);
        }

        const tokenResult = verifyAccessToken(accessToken, jwtSecret);
        if (!tokenResult.valid) {
            return res.json({
                error: tokenResult.error,
                expired: tokenResult.expired || false
            }, 401);
        }

        // Verify user still exists and is admin
        let user;
        try {
            user = await users.get(tokenResult.userId);
        } catch (err) {
            return res.json({ error: 'User not found' }, 401);
        }

        if (!user.labels?.includes('admin')) {
            return res.json({ error: 'Not an admin' }, 403);
        }

        // ========================================
        // Collection Validation
        // ========================================
        if (!collection || !MANAGED_COLLECTIONS.includes(collection)) {
            return res.json({
                error: 'Invalid collection',
                allowed: MANAGED_COLLECTIONS
            }, 400);
        }

        log(`CMS ${action} on ${collection} by ${user.email}`);

        // ========================================
        // CRUD Operations
        // ========================================
        switch (action) {
            case 'list': {
                const documents = await databases.listDocuments(
                    databaseId,
                    collection,
                    [Query.orderDesc('$createdAt')]
                );
                return res.json({
                    success: true,
                    total: documents.total,
                    documents: documents.documents
                });
            }

            case 'get': {
                if (!documentId) {
                    return res.json({ error: 'Document ID required' }, 400);
                }
                const document = await databases.getDocument(
                    databaseId,
                    collection,
                    documentId
                );
                return res.json({ success: true, document });
            }

            case 'create': {
                if (!data) {
                    return res.json({ error: 'Data required' }, 400);
                }
                const document = await databases.createDocument(
                    databaseId,
                    collection,
                    ID.unique(),
                    data
                );
                return res.json({ success: true, document });
            }

            case 'update': {
                if (!documentId || !data) {
                    return res.json({ error: 'Document ID and data required' }, 400);
                }
                const document = await databases.updateDocument(
                    databaseId,
                    collection,
                    documentId,
                    data
                );
                return res.json({ success: true, document });
            }

            case 'delete': {
                if (!documentId) {
                    return res.json({ error: 'Document ID required' }, 400);
                }
                await databases.deleteDocument(databaseId, collection, documentId);
                return res.json({ success: true, deleted: documentId });
            }

            default:
                return res.json({
                    error: 'Invalid action',
                    allowed: ['list', 'get', 'create', 'update', 'delete']
                }, 400);
        }
    } catch (err) {
        error(`CRUD error: ${err.message}`);
        return res.json({
            error: 'Operation failed',
            message: err.message
        }, 500);
    }
};
