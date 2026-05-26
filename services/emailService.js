const { resend, FROM_ADDRESS } = require('../lib/resend');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const isTest = process.env.NODE_ENV === 'test';

async function renderTemplate(template, data) {
  try {
    const response = await fetch(`${APP_URL}/api/emails/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, data }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Render failed');
    }

    const { html } = await response.json();
    return html;
  } catch (error) {
    console.error(`Render error for template "${template}":`, error.message);
    throw error;
  }
}

async function sendEmail({ to, subject, template, data }) {
  if (isTest) return;

  try {
    if (!process.env.RESEND_API_KEY) {
      console.log('Resend not configured. Skipping email.');
      return;
    }

    let html;
    try {
      html = await renderTemplate(template, data);
    } catch (renderErr) {
      console.warn(`Render failed for "${template}", using fallback:`, renderErr.message);
      html = buildFallbackHtml(subject, data.body || '');
    }

    const recipients = Array.isArray(to) ? to : [to];

    await resend.emails.send({
      from: FROM_ADDRESS,
      to: recipients,
      subject,
      html,
    });

    console.log(`Email sent: "${subject}" to ${recipients.join(', ')}`);
  } catch (error) {
    console.error(`Email send error for "${subject}":`, error.message);
    throw error;
  }
}

function buildFallbackHtml(subject, body) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f0f0f5;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="padding:40px 16px;">
        <table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#caa646,#d4af37);padding:40px 32px 32px;text-align:center;">
              <div style="width:56px;height:56px;margin:0 auto 14px;background:rgba(255,255,255,0.2);border-radius:14px;line-height:56px;font-size:22px;font-weight:800;color:#fff;">GC</div>
              <h1 style="margin:0;font-size:24px;color:#fff;font-weight:700;">Get Credit</h1>
              <p style="margin:4px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">Your Trusted Loan Partner</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#4a4a4a;font-size:15px;line-height:1.7;">
              ${body}
              <p style="margin-top:24px;">Warm regards,<br><strong style="color:#b8912c;font-size:16px;">The Get Credit Team</strong></p>
            </td>
          </tr>
          <tr>
            <td style="background:#1a1a2e;padding:24px 32px 20px;text-align:center;">
              <p style="margin:0 0 10px;font-size:12px;color:rgba(255,255,255,0.3);">Phone: +91 7738205198 / +91 8408926551 / +91 8793604734</p>
              <p style="margin:3px 0 10px;font-size:11px;color:rgba(255,255,255,0.3);">support@get-credit.in</p>
              <p style="margin:3px 0;font-size:11px;color:rgba(255,255,255,0.25);">&copy; ${year} Get Credit. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendCallbackClient(name, phone, loanType, createdAt, toEmail) {
  return sendEmail({
    to: toEmail,
    subject: 'Callback Request Received – Get Credit',
    template: 'callbackClient',
    data: { name, phone, loanType, createdAt },
  });
}

async function sendCallbackAdmin({ name, phone, email, city, loanType, source, createdAt }) {
  const adminEmail = process.env.ADMIN_EMAIL || 'support@get-credit.in';
  return sendEmail({
    to: adminEmail,
    subject: 'New Callback Request – Get Credit Admin',
    template: 'callbackAdmin',
    data: { name, phone, email, city, loanType, source, createdAt },
  });
}

async function sendEnquiryClient({ name, loanType, loanAmount, emi, tenure, tenureUnit, city, createdAt, toEmail }) {
  return sendEmail({
    to: toEmail,
    subject: 'Enquiry Submitted Successfully – Get Credit',
    template: 'enquiryClient',
    data: { name, loanType, loanAmount, emi, tenure, tenureUnit, city, createdAt },
  });
}

async function sendEnquiryAdmin({ name, phone, email, city, loanType, loanAmount, emi, tenure, tenureUnit, interestRate, source, createdAt }) {
  const adminEmail = process.env.ADMIN_EMAIL || 'support@get-credit.in';
  return sendEmail({
    to: adminEmail,
    subject: `New ${loanType || 'Loan'} Enquiry – Get Credit Admin`,
    template: 'enquiryAdmin',
    data: { name, phone, email, city, loanType, loanAmount, emi, tenure, tenureUnit, interestRate, source, createdAt },
  });
}

function sanitizeHtml(input) {
  const safe = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*on\w+\s*=\s*["'][^"']*["'][^>]*>/gi, '')
    .replace(/<[^>]*on\w+\s*=\s*[^\s>]+[^>]*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/onerror\s*=/gi, '');
  return safe;
}

async function sendAdminComposeEmail({ to, subject, body }) {
  return sendEmail({
    to,
    subject,
    template: 'adminCompose',
    data: { body: sanitizeHtml(body).replace(/\n/g, '<br>') },
  });
}

module.exports = {
  sendCallbackClient,
  sendCallbackAdmin,
  sendEnquiryClient,
  sendEnquiryAdmin,
  sendAdminComposeEmail,
};
