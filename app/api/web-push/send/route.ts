import webpush from 'web-push'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/firebase/auth';

// TODO: Make sure this nofication enpoint is secured
export async function POST(request: Request) {
    try {
        // Authenticate the user
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Set VAPID details for web-push library
        webpush.setVapidDetails(
            process.env.VAPID_SUBJECT || 'mailto:example@domain.com',
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
            process.env.VAPID_PRIVATE_KEY!
        );

        const { userID, title, body, url } = await request.json();
        
        // Validate input
        if (!userID || !title || !body) {
            return NextResponse.json({ error: 'Missing required fields: userID, title, body' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { user_id: userID },
        })

        // Check if user exists
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Check if user is subscribed to the push notification
        if (!user?.push_subscription) {
            return NextResponse.json({ error: 'User is not subscribed to push notifications'}, { status: 404 })
        };

        // Takes the subscription JSON from the database
        const subscription = JSON.parse(user?.push_subscription!);

        // Send the notification as a string to the user
        // Also takes metadata which is the url or route the notification object is going to point to
        await webpush.sendNotification(
            subscription,
            JSON.stringify({
                title, 
                body,
                data: {
                    url: url || "/" // defaults to the home directory if no url is found
                }
            })
        );

        // Return a sucess message of sending the notification
        return NextResponse.json({ message: "Successfully sent notification to the user!" }, { status: 200 });
    } catch (error) {
        console.error("Failed to send notification:", error);
        return NextResponse.json({ error: `Failed to send notification: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 })
    }
}