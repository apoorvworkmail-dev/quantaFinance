import nodemailer from "nodemailer";

// Creates a test transporter using Ethereal (fake SMTP for dev)
// In production, replace with real SMTP credentials from .env
let transporter: nodemailer.Transporter;

const getTransporter = async () => {
  if (transporter) return transporter;

  // Use env variables if available (production)
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Dev: use Ethereal fake SMTP (emails visible at https://ethereal.email)
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log("📧 Ethereal test account created:", testAccount.user);
  }

  return transporter;
};

export const sendOTPEmail = async (
  to: string,
  name: string,
  otp: string,
  type: "forgot_password" | "transfer_otp" | "login_otp"
) => {
  const tp = await getTransporter();

  const subjects: Record<string, string> = {
    forgot_password: "QuantaBank — Reset Your Password",
    transfer_otp:   "QuantaBank — Transfer Verification Code",
    login_otp:      "QuantaBank — Login Verification Code",
  };

  const titles: Record<string, string> = {
    forgot_password: "Password Reset Request",
    transfer_otp:   "Transfer Authorization Code",
    login_otp:      "Login Verification Code",
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#0a0f1e;font-family:Inter,sans-serif;">
      <div style="max-width:480px;margin:40px auto;background:#111827;border:1px solid #1e2d45;border-radius:16px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#3b82f6,#818cf8);padding:28px 32px;">
          <h1 style="color:white;margin:0;font-size:22px;font-weight:800;">🏦 QuantaBank</h1>
          <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">Internet Banking Security</p>
        </div>
        <div style="padding:32px;">
          <h2 style="color:#f1f5f9;margin:0 0 8px;font-size:18px;">${titles[type]}</h2>
          <p style="color:#94a3b8;font-size:14px;margin:0 0 28px;">Hi ${name}, here is your verification code:</p>
          
          <div style="background:#0a0f1e;border:1px solid #1e2d45;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
            <div style="font-size:40px;font-weight:800;letter-spacing:10px;color:#3b82f6;font-family:monospace;">${otp}</div>
          </div>
          
          <p style="color:#475569;font-size:12px;margin:0 0 16px;">⏱️ This code expires in <strong style="color:#f1f5f9;">10 minutes</strong>.</p>
          <p style="color:#475569;font-size:12px;margin:0;">🔒 Never share this code with anyone. QuantaBank will never ask for your OTP.</p>
        </div>
        <div style="padding:20px 32px;background:#0f1628;border-top:1px solid #1e2d45;">
          <p style="color:#475569;font-size:11px;margin:0;text-align:center;">© 2026 QuantaBank. This is an automated email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const info = await tp.sendMail({
    from: '"QuantaBank" <noreply@quantabank.com>',
    to,
    subject: subjects[type],
    html,
  });

  // In dev, log the preview URL
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) {
    console.log(`\n📧 Email Preview URL: ${preview}\n`);
  }

  return info;
};
