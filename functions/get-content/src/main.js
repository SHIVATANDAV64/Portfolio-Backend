import { Client, Databases } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
    // Initialize Appwrite client
    const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const databaseId = process.env.DATABASE_ID;

    // Get collection name from query params
    const collection = req.query?.collection;

    // Allowed public collections
    const allowedCollections = [
        'about',
        'skills',
        'projects',
        'experience',
        'testimonials',
        'services',
        'social_links',
        'hero'
    ];

    if (!collection) {
        return res.json({
            error: 'Missing collection parameter',
            allowed: allowedCollections
        }, 400);
    }

    if (!allowedCollections.includes(collection)) {
        return res.json({
            error: 'Invalid collection',
            allowed: allowedCollections
        }, 400);
    }

    try {
        log(`Fetching collection: ${collection}`);

        const data = await databases.listDocuments(databaseId, collection);

        return res.json({
            success: true,
            collection,
            total: data.total,
            documents: data.documents
        });
    } catch (err) {
        error(`Error fetching ${collection}: ${err.message}`);
        return res.json({
            error: 'Failed to fetch content',
            message: err.message
        }, 500);
    }
};
