'use server'

import { findUserByEmail } from "@/lib/user"
import { verifyEmail } from "../../cadastro/form/verify-types"


export default async function verifyEmailForgotPassword(email: string) {

    if (email.trim() == '') {
        return true
    }

    const verify = await verifyEmail(email)
    if (!verify) {
        return true
    }

    const user = await findUserByEmail(email)

    if (!user) {
        return true
    }

    return false
}