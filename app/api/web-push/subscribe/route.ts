import { NextResponse } from 'next/server';
import { getSession } from '@/lib/firebase/auth';
import { notificationSchema } from '@/lib/validation/notification';
import { z } from 'zod';
import { setUserPushSubscription } from '@/lib/services/webPushService';

// Initialize the type for the subscription, referring to the notificationSchema zod validation
type PushSubscription = z.infer<typeof notificationSchema>;

// Only allow specific push services to give web-push notifications
const ALLOWED_PUSH_SERVICES = [
"fcm.googleapis.com",
"updates.push.services.mozilla.com",
"push.apple.com",
];

// Check if the enpoint includes any of the allowed push services
function isValidPushService(endpoint: string): boolean {
    try {
        const url = new URL(endpoint);
        return ALLOWED_PUSH_SERVICES.some(service => 
        url.hostname.includes(service));
    } catch {
        return false;
    }
}

/**
 * @swagger
 * /api/web-push/subscribe:
 *   post:
 *     summary: Register the authenticated user's web-push subscription
 *     description: Stores the browser PushSubscription on the user. The endpoint must belong to an allowed push service (FCM, Mozilla, or Apple) and the payload must be under 5000 bytes.
 *     tags:
 *       - Web Push
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - endpoint
 *               - keys
 *             properties:
 *               endpoint:
 *                 type: string
 *                 format: uri
 *               keys:
 *                 type: object
 *                 required:
 *                   - p256dh
 *                   - auth
 *                 properties:
 *                   p256dh:
 *                     type: string
 *                   auth:
 *                     type: string
 *     responses:
 *       200:
 *         description: Subscription stored.
 *       400:
 *         description: Invalid JSON, validation failure, unrecognized push service, or payload too large.
 *       401:
 *         description: Not authenticated.
 *       500:
 *         description: Failed to store subscription.
 */
export async function POST(request: Request) {
try {
    // Make sure the user is authenticated
    const session = await getSession();
    if (!session){
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the body from the request json, this will then be validated by zod
    let body: unknown;
    try{
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Validate subsciption JSON structure
    const parsed = notificationSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({error: "Validation failed", details: parsed.error.flatten().fieldErrors}, { status: 400 })
    }

    // Take the parsed JSON, store it as the subscription JSON that has already been sanitized
    const subscription: PushSubscription = parsed.data;

    // Warn if the user is trying to subscribe using an unlisted push service
    if (!isValidPushService(subscription.endpoint)) {
        console.warn(
            `[SECURITY] User ${session.id} attempted to register unknown push service: ${subscription.endpoint}`
        );
        return NextResponse.json(
            { error: "Push service endpoint not recognized" },
            { status: 400 }
        );
    }

    // Make sure the subscription payload is not too large
    const subscriptionString = JSON.stringify(subscription);
    if (subscriptionString.length > 5000) {
        return NextResponse.json(
            { error: "Subscription payload too large!" },
            { status: 400 }
        );
    }

    // TODO: Move to service notification
    // Update the push_subcription field in the USER model of the DB
    await setUserPushSubscription(session.id, JSON.stringify(subscription));

    return NextResponse.json({ message: "Sucessfully set notifications on" }, { status: 200 });
} catch (error) {
    console.error("Failed to set notifications on", error);
    return NextResponse.json({ error: "Failed in setting notifications on!" }, { status: 500 });
    } 
}

