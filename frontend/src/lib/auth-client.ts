import { API_URL } from '$lib/config'

export interface User {
    id: number
    username: string
    email: string
    avatar: string | null
    slackId: string | null
    scraps: number
    role: string
}

let cachedUser: User | null | undefined = undefined
let fetchPromise: Promise<User | null> | null = null

export function login() {
    window.location.href = `${API_URL}/auth/login`
}

export async function logout() {
    cachedUser = undefined
    fetchPromise = null
    await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include"
    })
    window.location.href = "/"
}

export async function getUser(): Promise<User | null> {
    if (cachedUser !== undefined) return cachedUser

    if (fetchPromise) return fetchPromise

    fetchPromise = (async (): Promise<User | null> => {
        try {
            const response = await fetch(`${API_URL}/auth/me`, {
                credentials: "include"
            })
            if (!response.ok) {
                cachedUser = null
                return null
            }
            const data = await response.json()
            if (data.banned) {
                window.location.href = 'https://fraud.land'
                cachedUser = null
                return null
            }
            cachedUser = (data.user as User) || null
            return cachedUser
        } catch {
            cachedUser = null
            return null
        } finally {
            fetchPromise = null
        }
    })()

    return fetchPromise
}
