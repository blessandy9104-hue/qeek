import nodemailer from 'nodemailer';

export interface DeliveryResult {
  delivered: boolean;
  /** Present only when no SMTP is configured (dev mode). */
  devCode?: string;
}

/**
 * Deliver a login code. If QEEK_SMTP_URL is set (e.g. a Proton Bridge
 * SMTP URL for sending from a @proton.me address), the code is emailed
 * for real — any recipient inbox works, including @proton.me and
 * @protonmail.com. Otherwise the code is printed to the server console
 * (dev mode) and returned so local flows and tests can proceed.
 *
 * QEEK_SMTP_URL examples:
 *   smtp://user:pass@127.0.0.1:1025          (Proton Bridge default)
 *   smtps://user:pass@mail.example.com:465
 */
export async function deliverCode(email: string, code: string): Promise<DeliveryResult> {
  const smtpUrl = process.env.QEEK_SMTP_URL || '';
  if (!smtpUrl) {
    console.log(`[qeek-auth] login code for ${email}: ${code}`);
    return { delivered: false, devCode: code };
  }
  const transporter = nodemailer.createTransport(smtpUrl);
  const from =
    process.env.QEEK_SMTP_FROM || 'qeek <no-reply@localhost>';
  await transporter.sendMail({
    from,
    to: email,
    subject: 'Your qeek login code',
    text:
      `Your qeek login code is: ${code}\n\n` +
      `It expires in 10 minutes. If you did not request it, ignore this email.`,
  });
  return { delivered: true };
}
