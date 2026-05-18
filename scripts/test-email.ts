import { Resend } from "resend";

async function main(): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.EMAIL_TO;
  if (!apiKey || !to) {
    console.error("Missing RESEND_API_KEY or EMAIL_TO env vars.");
    process.exit(1);
  }
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: "Sylndr Alert <onboarding@resend.dev>",
    to,
    subject: "Sylndr alerts: test email",
    html: `<p>This is a test email from sylndr-alert. If you got this, your Resend setup is working. New-listing alerts will start arriving when Sylndr publishes cars matching your filter.</p>`,
  });
  if (error) {
    console.error("Resend error:", error);
    process.exit(1);
  }
  console.log("Test email sent:", data);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
