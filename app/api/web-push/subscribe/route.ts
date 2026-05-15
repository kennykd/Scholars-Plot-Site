import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/firebase/auth';

export async function POST(request: Request) {
    try {
        // Make sure the user is authenticated 
        const session = await getSession();
        if (!session){
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // get the subscription from request json
        const { subscription } = await request.json()

        // Update the push_subcription field in the USER model of the DB
        await prisma.user.update({
            where: { user_id: session.id },
            data: { push_subscription: JSON.stringify(subscription) },
        });

        return NextResponse.json({ message: "Sucessfully set notifications on" }, { status: 200 });
    } catch (error) {
        console.error("Failed to set notifications on", error);
        return NextResponse.json({ error: "Failed in setting notifications on!" }, { status: 500 });
    } 
}

