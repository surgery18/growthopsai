// import { Env } from "../../worker-configuration"
import { MailjetService } from "./mailjet"

export class AuthService {
	private mailjet: MailjetService

	constructor(private env: Env) {
		this.mailjet = new MailjetService(env)
	}

	async generateOTP(
		email: string,
	): Promise<{ success: boolean; error?: string }> {
		// 1. Check Allowlist
		const allowedEmails = (this.env.ALLOWED_EMAILS || "")
			.split(",")
			.map((e) => e.trim())
		if (!allowedEmails.includes(email)) {
			return { success: false, error: "You do not have permission." }
		}

		// 2. Generate Code
		const code = Math.floor(100000 + Math.random() * 900000).toString()

		// 3. Send Email
		try {
			await this.mailjet.sendEmail(
				email,
				"Your Login Code - GrowthOpsAI",
				`<h3>Your login code is: <b>${code}</b></h3><p>Expires in 15 minutes.</p>`,
			)
		} catch (e: any) {
			console.error("Failed to send OTP:", e)
			return { success: false, error: "Failed to send email." }
		}

		// 4. Store in KV (15 mins TTL)
		// Store simple string code
		// Key: email, Value: code
		await this.env.KV_AUTH.put(email, code, { expirationTtl: 15 * 60 })

		return { success: true }
	}

	async verifyOTP(email: string, code: string): Promise<boolean> {
		console.log("Verifying OTP for:", email)

		const storedCode = await this.env.KV_AUTH.get(email)

		if (!storedCode) {
			console.log("No OTP found in KV (Expired or invalid email)")
			return false
		}

		if (storedCode !== code) {
			console.log(`Code mismatch. Stored: ${storedCode}, Provided: ${code}`)
			return false
		}

		// Consume OTP (Delete after use)
		await this.env.KV_AUTH.delete(email)

		console.log("OTP Verified Successfully via KV")
		return true
	}
}
