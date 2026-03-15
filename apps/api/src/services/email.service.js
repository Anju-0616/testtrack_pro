const { Resend } = require("resend");

// Lazy initialization — Resend is only created when actually sending an email.
// This prevents CI from crashing on startup when RESEND_API_KEY is a dummy value.
let resendClient = null;

function getResend() {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  await getResend().emails.send({
    from: "TestTrack Pro <onboarding@resend.dev>",
    to: email,
    subject: "Verify your account",
    html: `
      <h2>Welcome to TestTrack Pro</h2>
      <p>Please verify your account by clicking the link below:</p>
      <a href="${verifyUrl}">${verifyUrl}</a>
    `,
  });
};

module.exports = { sendVerificationEmail };