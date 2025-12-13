import { Client, Databases, ID } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.json({ error: 'Method not allowed' }, 405);
    }

    const client = new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);
    const databaseId = process.env.DATABASE_ID;

    try {
        const body = JSON.parse(req.body || '{}');

        // Validate required fields
        const { name, email, subject, message } = body;

        if (!name || !email || !message) {
            return res.json({
                error: 'Missing required fields',
                required: ['name', 'email', 'message']
            }, 400);
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.json({ error: 'Invalid email format' }, 400);
        }

        log(`New contact submission from: ${email}`);

        // Save to database
        const document = await databases.createDocument(
            databaseId,
            'messages',
            ID.unique(),
            {
                name,
                email,
                subject: subject || 'No Subject',
                message,
                created_at: new Date().toISOString(),
                read: false
            }
        );

        // TODO: Add email notification here if needed
        // You can integrate with SendGrid, Resend, or Appwrite's messaging service

        return res.json({
            success: true,
            message: 'Contact form submitted successfully',
            id: document.$id
        });
    } catch (err) {
        error(`Error saving contact: ${err.message}`);
        return res.json({
            error: 'Failed to submit contact form',
            message: err.message
        }, 500);
    }
};
