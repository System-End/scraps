import 'dotenv/config'

const isDev = process.env.NODE_ENV !== 'production'

export const config = {
	isDev,
	port: 3000,
	
	// Database (always from .env)
	databaseUrl: process.env.DATABASE_URL!,
	
	// Frontend
	frontendUrl: isDev
		? 'http://localhost:5173'
		: process.env.FRONTEND_URL!,
	
	// HackClub Auth
	hcauth: {
		clientId: process.env.HCAUTH_CLIENT_ID!,
		clientSecret: process.env.HCAUTH_CLIENT_SECRET!,
		redirectUri: isDev
			? 'http://localhost:3000/auth/callback'
			: process.env.HCAUTH_REDIRECT_URI!
	},
	
	// Slack
	slackBotToken: process.env.SLACK_BOT_TOKEN,
	
	// HCCDN
	hccdnKey: process.env.HCCDN_KEY
}
