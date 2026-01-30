import { Elysia } from 'elysia'
import { getUserFromSession, checkUserEligibility } from '../lib/auth'

const user = new Elysia({ prefix: '/user' })

user.get('/me', async ({ headers }) => {
    const userData = await getUserFromSession(headers as Record<string, string>)
    if (!userData) return { error: 'Unauthorized' }

    let yswsEligible = false
    let verificationStatus = 'unknown'

    if (userData.accessToken) {
        const eligibility = await checkUserEligibility(userData.accessToken)
        if (eligibility) {
            yswsEligible = eligibility.yswsEligible
            verificationStatus = eligibility.verificationStatus
        }
    }

    return {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        avatar: userData.avatar,
        slackId: userData.slackId,
        scraps: userData.scraps,
        yswsEligible,
        verificationStatus
    }
})

export default user
