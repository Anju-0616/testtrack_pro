const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  await resend.emails.send({
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