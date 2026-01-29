export const RequestAccessToken = async function(code: string): Promise<{
    access_token?: string,
    failure_reason?: string
}> {
    try {
        const response = await fetch("https://auth.hackclub.com/oauth/token", {
            method: "POST",
            body: JSON.stringify({
                code,

                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,

                grant_type: "authorization_code",
                redirect_uri: process.env.REDIRECT_URI,
            })
        });

        if (response.status !== 200)
            return { failure_reason: "" };

        
    } catch (err) {
        return { failure_reason: "Internal Error" };
    }
}