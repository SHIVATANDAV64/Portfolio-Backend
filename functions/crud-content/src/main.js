import { Client, Databases, ID, Query, Storage } from 'node-appwrite';

// JWT verification helper (same as admin-auth)
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
            return null;
        }

        return payload;
    } catch {
        return null;
    }
};

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

export default async ({ req, res, log, error }) => {
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const storage = new Storage(client);
    const databaseId = process.env.DATABASE_ID;
    const jwtSecret = process.env.JWT_SECRET;
    const storageBucketId = process.env.STORAGE_BUCKET_ID;

    // Verify JWT from Authorization header
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.json({ error: 'Unauthorized - No token provided' }, 401);
    }

    const token = authHeader.substring(7);
    const user = await verifyJWT(token, jwtSecret);

    if (!user || user.role !== 'admin') {
        return res.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    try {
        const body = JSON.parse(req.body || '{}');
        const { action, collection, documentId, data } = body;

        // Validate collection
        if (!collection || !MANAGED_COLLECTIONS.includes(collection)) {
            return res.json({
                error: 'Invalid collection',
                allowed: MANAGED_COLLECTIONS
            }, 400);
        }

        log(`CMS ${action} on ${collection} by ${user.email}`);

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
                    {
                        ...data,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }
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
                    {
                        ...data,
                        updated_at: new Date().toISOString()
                    }
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
