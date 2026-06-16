import { NextResponse } from 'next/server';
import { getSession } from '@/lib/firebase/auth';
import { clearUserPushSubscription } from '@/lib/services/webPushService';

/**
 * @swagger
 * /api/web-push/unsubscribe:
 *   delete:
 *     summary: Clear the authenticated user's web-push subscription
 *     tags:
 *       - Web Push
 *     responses:
 *       200:
 *         description: Subscription cleared.
 *       401:
 *         description: Not authenticated.
 *       500:
 *         description: Failed to clear subscription.
 */
export async function DELETE() {
    try {
        // Make sure the user is authenticated 
        const session = await getSession();
        if (!session){
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Update the push_subcription field in the USER model of the DB
        await clearUserPushSubscription(session.id);

        return NextResponse.json({ message: "Sucessfully turned of notifications" });
    } catch (error) {
        console.error("Failed to set notifications off", error);
        return NextResponse.json({ error: "Failed in setting notifications on!" }, { status: 500 });
    } 
}

