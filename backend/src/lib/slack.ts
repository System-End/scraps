interface SlackProfile {
    avatar_hash: string
    display_name: string
    display_name_normalized: string
    email: string
    first_name: string
    last_name: string
    real_name: string
    image_24: string
    image_32: string
    image_48: string
    image_72: string
    image_192: string
    image_512: string
}

interface SlackProfileResponse {
    ok: boolean
    profile?: SlackProfile
    error?: string
}

export async function getSlackProfile(slackId: string, token: string): Promise<SlackProfile | null> {
    try {
        const response = await fetch(`https://slack.com/api/users.profile.get?user=${slackId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        })

        const data: SlackProfileResponse = await response.json()

        if (data.ok && data.profile) {
            return data.profile
        }

        console.error('Slack API error:', data.error)
        return null
    } catch (error) {
        console.error('Failed to fetch Slack profile:', error)
        return null
    }
}

export function getAvatarUrl(profile: SlackProfile): string {
    return profile.image_192 || profile.image_512 || profile.image_72 || profile.image_48
}
