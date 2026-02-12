import admin from "firebase-admin"


if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId:"",
            clientEmail:"",
            privateKey:""
        })
    })
}

export const adminAuth = admin.auth()