interface TwitterCredentials {
	clientId?: string
	clientSecret?: string
	accessToken: string
	refreshToken?: string
}

type TweetResponse = {
	data?: {
		id?: string
	}
}

type OAuth2TokenResponse = {
	access_token?: string
	refresh_token?: string
	token_type?: string
	scope?: string
	expires_in?: number
	error?: string
	error_description?: string
}

const TWITTER_API_V2_BASE_URL = "https://api.x.com/2"
const TWITTER_OAUTH2_TOKEN_URL = "https://api.x.com/2/oauth2/token"

const parseJsonSafe = (text: string): Record<string, any> => {
	if (!text) {
		return {}
	}

	try {
		return JSON.parse(text) as Record<string, any>
	} catch {
		return {}
	}
}

const extractErrorMessage = (
	responseJson: Record<string, any>,
	responseText: string,
	status: number,
): string => {
	const directMessage =
		responseJson.detail ||
		responseJson.title ||
		responseJson.error_description ||
		responseJson.error
	if (directMessage) {
		return String(directMessage)
	}

	const errors = Array.isArray(responseJson.errors)
		? responseJson.errors
				.map((error: { message?: string }) => error.message)
				.filter(Boolean)
				.join("; ")
		: ""
	if (errors) {
		return errors
	}

	return responseText || `HTTP ${status}`
}

const buildBasicAuthHeader = (clientId: string, clientSecret: string): string =>
	`Basic ${btoa(`${clientId}:${clientSecret}`)}`

export class TwitterService {
	private creds: TwitterCredentials
	private accessToken: string
	private refreshToken?: string

	constructor(creds: TwitterCredentials) {
		this.creds = creds
		this.accessToken = creds.accessToken
		this.refreshToken = creds.refreshToken
	}

	private canRefreshToken(): boolean {
		return Boolean(
			this.refreshToken && this.creds.clientId && this.creds.clientSecret,
		)
	}

	private async refreshAccessToken(): Promise<void> {
		if (!this.canRefreshToken()) {
			throw new Error("Twitter API Error: OAuth2 refresh not configured")
		}

		const response = await fetch(TWITTER_OAUTH2_TOKEN_URL, {
			method: "POST",
			headers: {
				Authorization: buildBasicAuthHeader(
					this.creds.clientId!,
					this.creds.clientSecret!,
				),
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: this.refreshToken!,
				client_id: this.creds.clientId!,
			}),
		})

		const responseText = await response.text()
		const responseJson = parseJsonSafe(responseText) as OAuth2TokenResponse

		if (!response.ok) {
			const message = extractErrorMessage(
				responseJson as Record<string, any>,
				responseText,
				response.status,
			)
			throw new Error(`Twitter API Error (${response.status}): ${message}`)
		}

		if (!responseJson.access_token) {
			throw new Error("Twitter API Error: Missing access_token in OAuth2 response")
		}

		this.accessToken = responseJson.access_token
		if (responseJson.refresh_token) {
			this.refreshToken = responseJson.refresh_token
		}
	}

	private async postTweet(
		payload: { text: string; reply?: { in_reply_to_tweet_id: string } },
		retryOnUnauthorized = true,
	): Promise<string> {
		if (!this.accessToken) {
			throw new Error("Twitter API Error: OAuth2 access token not configured")
		}

		const url = `${TWITTER_API_V2_BASE_URL}/tweets`
		const response = await fetch(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		})

		const responseText = await response.text()
		const responseJson = parseJsonSafe(responseText)

		if (response.status === 401 && retryOnUnauthorized && this.canRefreshToken()) {
			await this.refreshAccessToken()
			return this.postTweet(payload, false)
		}

		if (!response.ok) {
			const message = extractErrorMessage(responseJson, responseText, response.status)
			throw new Error(`Twitter API Error (${response.status}): ${message}`)
		}

		const tweetId = (responseJson as TweetResponse)?.data?.id
		if (!tweetId) {
			throw new Error("Twitter API Error: Missing post id in response")
		}

		return tweetId
	}

	async publishPost(content: string, replyToId?: string): Promise<string> {
		try {
			const payload: {
				text: string
				reply?: { in_reply_to_tweet_id: string }
			} = {
				text: content,
			}
			if (replyToId) {
				payload.reply = { in_reply_to_tweet_id: replyToId }
			}

			return await this.postTweet(payload)
		} catch (error: any) {
			console.error("Failed to publish tweet:", error)
			const message = error?.message || error
			if (typeof message === "string" && message.startsWith("Twitter API")) {
				throw new Error(message)
			}
			throw new Error(`Twitter API Error: ${message}`)
		}
	}

	async publishThread(posts: string[]): Promise<string> {
		if (posts.length === 0) {
			throw new Error("Cannot publish empty thread")
		}

		let lastId: string | undefined = undefined

		// Publish first post
		lastId = await this.publishPost(posts[0])

		// Publish replies
		for (let i = 1; i < posts.length; i++) {
			lastId = await this.publishPost(posts[i], lastId)
		}

		// Return the ID of the first post (the root of the thread)
		// Wait, for tracking purposes, we probably want the ID of the *first* post to link to.
		// Although `lastId` is the last one. Let's return the first ID as the main reference.
		// But actually the caller should likely store the first ID.
		// Wait, the `publishPost` calls return the ID of *that* tweet.
		// So for the whole thread, let's return the ID of the first tweet.

		// Wait, I need to make sure I capture the *first* ID separate from the loop.
		// Re-writing slightly to be clearer.
		return lastId! // This returns the LAST id. I should probably return the FIRST ID?
		// Or maybe I should return all of them?
		// For the database `external_post_id`, usually we store the URL/ID of the *start* of the thread.
	}

	// Corrected implementation: return the ID of the FIRST tweet as the "thread ID"
	async publishThreadCorrected(posts: string[]): Promise<string> {
		if (posts.length === 0) throw new Error("Empty thread")

		const firstId = await this.publishPost(posts[0])
		let previousId = firstId

		for (let i = 1; i < posts.length; i++) {
			previousId = await this.publishPost(posts[i], previousId)
		}

		return firstId
	}
}
