// import { Env } from "../../worker-configuration"

export class MailjetService {
	constructor(private env: Env) {}

	async sendEmail(to: string, subject: string, html: string) {
		const auth = btoa(
			`${this.env.MAILJET_API_KEY}:${this.env.MAILJET_API_SECRET}`,
		)

		// Default sender - relying on user having verified this or a default domain
		// Ideally this should be configurable
		const fromEmail = "noreply@growthopsai.xyz"

		const response = await fetch("https://api.mailjet.com/v3.1/send", {
			method: "POST",
			headers: {
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				Messages: [
					{
						From: {
							Email: fromEmail,
							Name: "GrowthOpsAI Admin",
						},
						To: [
							{
								Email: to,
								Name: "Admin",
							},
						],
						Subject: subject,
						HTMLPart: html,
					},
				],
			}),
		})

		if (!response.ok) {
			const errorText = await response.text()
			console.error("Mailjet Error:", errorText)
			throw new Error(
				`Mailjet send failed: ${response.status} ${response.statusText}`,
			)
		}

		return response.json()
	}
}
