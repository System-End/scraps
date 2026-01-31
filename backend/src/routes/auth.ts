import { Elysia } from "elysia"
import {
    getAuthorizationUrl,
    exchangeCodeForTokens,
    fetchUserIdentity,
    createOrUpdateUser,
    createSession,
    deleteSession,
    getUserFromSession
} from "../lib/auth"

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173"

const authRoutes = new Elysia({ prefix: "/auth" })

// GET /auth/login - Redirect to Hack Club Auth
authRoutes.get("/login", ({ redirect }) => {
    console.log("[AUTH] Login initiated")
    return redirect(getAuthorizationUrl())
})

// Track used codes to prevent double-submission
const usedCodes = new Set<string>()

// GET /auth/callback - Handle OIDC callback
authRoutes.get("/callback", async ({ query, redirect, cookie }) => {
    console.log("[AUTH] Callback received")
    const code = query.code as string | undefined

    if (!code || typeof code !== "string") {
        console.log("[AUTH] Callback error: no code provided")
        return redirect(`${FRONTEND_URL}/auth/error?reason=auth-failed`)
    }

    // Check if code was already used (prevents double-submission on refresh)
    if (usedCodes.has(code)) {
        console.log("[AUTH] Code already used, redirecting to dashboard")
        return redirect(`${FRONTEND_URL}/dashboard`)
    }
    usedCodes.add(code)
    
    // Clean up old codes after 5 minutes
    setTimeout(() => usedCodes.delete(code), 5 * 60 * 1000)

    try {
        const tokens = await exchangeCodeForTokens(code)
        if (!tokens) {
            console.log("[AUTH] Callback error: token exchange failed")
            usedCodes.delete(code)
            return redirect(`${FRONTEND_URL}/auth/error?reason=auth-failed`)
        }

        const meResponse = await fetchUserIdentity(tokens.access_token)
        if (!meResponse) {
            console.log("[AUTH] Callback error: failed to fetch user identity")
            return redirect(`${FRONTEND_URL}/auth/error?reason=auth-failed`)
        }

        const { identity } = meResponse
        console.log("[AUTH] Identity received:", {
            id: identity.id,
            email: identity.primary_email,
            slackId: identity.slack_id,
            yswsEligible: identity.ysws_eligible,
            verificationStatus: identity.verification_status
        })

        const user = await createOrUpdateUser(identity, tokens)
        const sessionToken = await createSession(user.id)
        console.log("[AUTH] User authenticated successfully:", { userId: user.id, username: user.username })

        cookie.session.set({
            value: sessionToken,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "lax" : "none",
            maxAge: 7 * 24 * 60 * 60,
            path: "/"
        })

        return redirect(`${FRONTEND_URL}/dashboard`)
    } catch (error) {
        const msg = error instanceof Error ? error.message : "unknown"
        console.log("[AUTH] Callback error:", msg, error)
        if (msg === "not-eligible") {
            return redirect(`${FRONTEND_URL}/auth/error?reason=not-eligible`)
        }
        return redirect(`${FRONTEND_URL}/auth/error?reason=auth-failed`)
    }
})

// GET /auth/me - Get current user
authRoutes.get("/me", async ({ headers }) => {
    console.log(headers)
    const user = await getUserFromSession(headers as Record<string, string>)
    console.log("[AUTH] /me check:", user ? { userId: user.id, username: user.username } : "no session")
    if (!user) return { user: null }
    return {
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            slackId: user.slackId,
            scraps: user.scraps,
            role: user.role
        }
    }
})

// POST /auth/logout
authRoutes.post("/logout", async ({ cookie }) => {
    console.log("[AUTH] Logout requested")
    const token = cookie.session.value as string | undefined
    if (token) {
        await deleteSession(token)
        cookie.session.remove()
    }
    return { success: true }
})

export default authRoutes
