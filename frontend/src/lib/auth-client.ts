import { API_URL } from '$lib/config'

export function login() {
    window.location.href = `${API_URL}/auth/login`
}

export async function logout() {
    await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include"
    })
    window.location.href = "/"
}

export async function getUser() {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            credentials: "include"
        })
        if (!response.ok) return null
        const data = await response.json()
        return data.user || null
    } catch {
        return null
    }
}
