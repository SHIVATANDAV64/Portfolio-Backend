import { Client, Databases, Users, ID, Query, Storage } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
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
        // File Operations (no collection validation needed)
        // ========================================
        if (action === 'upload') {
            const { fileData, fileName, mimeType } = body;
            if (!fileData || !fileName) {
                return res.json({ error: 'File data and name required' }, 400);
            }

            // Validate mime type
            const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
            if (mimeType && !allowedTypes.includes(mimeType)) {
                return res.json({ error: 'Invalid file type. Allowed: JPG, PNG, WebP, GIF, SVG' }, 400);
            }

            try {
                // Decode base64 to Buffer
                const buffer = Buffer.from(fileData, 'base64');

                // Validate file size (10MB max)
                if (buffer.length > 10 * 1024 * 1024) {
                    return res.json({ error: 'File too large. Maximum: 10MB' }, 400);
                }

                // Create InputFile from buffer (correct import from node-appwrite/file)
                const inputFile = InputFile.fromBuffer(buffer, fileName);

                const file = await storage.createFile(
                    storageBucketId,
                    ID.unique(),
                    inputFile
                );

                // Build public URL
                const endpoint = process.env.APPWRITE_ENDPOINT;
                const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
                const url = `${endpoint}/storage/buckets/${storageBucketId}/files/${file.$id}/view?project=${projectId}`;

                log(`File uploaded: ${file.$id} by ${user.email}`);
                return res.json({ success: true, fileId: file.$id, url });
            } catch (uploadErr) {
                error(`Upload failed: ${uploadErr.message}`);
                return res.json({ error: 'Upload failed', message: uploadErr.message }, 500);
            }
        }

        if (action === 'deleteFile') {
            const { fileId } = body;
            if (!fileId) {
                return res.json({ error: 'File ID required' }, 400);
            }

            try {
                await storage.deleteFile(storageBucketId, fileId);
                log(`File deleted: ${fileId} by ${user.email}`);
                return res.json({ success: true, deleted: fileId });
            } catch (deleteErr) {
                error(`Delete failed: ${deleteErr.message}`);
                return res.json({ error: 'Delete failed', message: deleteErr.message }, 500);
            }
        }

        // ========================================
        // Collection Validation (for CRUD operations)
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
                    allowed: ['list', 'get', 'create', 'update', 'delete', 'upload', 'deleteFile']
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
