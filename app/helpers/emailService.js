class EmailService {
    async sendEmail(to, subject, html, text = null) {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) throw new Error('RESEND_API_KEY is missing');

        const fromEmail = process.env.FROM_EMAIL || 'no-reply@rhymo.vitalize.dev';
        const fromName = process.env.FROM_NAME || 'Rhymo';
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: `${fromName} <${fromEmail}>`,
                to: Array.isArray(to) ? to : [to],
                subject,
                html,
                text: text || this.stripHtml(html)
            }),
            signal: AbortSignal.timeout(10_000),
            redirect: 'error'
        });

        if (!response.ok) throw new Error(`Resend rejected the email (HTTP ${response.status})`);
        const { id } = await response.json();
        if (!id) throw new Error('Resend did not return a message ID');
        return { success: true, messageId: id };
    }

    async sendPasswordResetEmail(email, resetCode) {
        return this.sendCodeEmail(email, 'Reset your password', 'Enter this code in Rhymo to reset your password.', resetCode);
    }

    async sendEmailVerification(email, verificationCode) {
        return this.sendCodeEmail(email, 'Verify your email', 'Enter this code in Rhymo to finish creating your account.', verificationCode);
    }

    async sendCodeEmail(email, title, instruction, code) {
        if (!/^\d{6}$/.test(code)) throw new Error('Invalid Rhymo email code');
        const expiry = 'This code expires in 10 minutes.';
        const ignore = 'If you didn’t request this, you can ignore this email.';
        const codeBlock = `<p style="margin:24px 0 16px;padding:18px 12px;border-radius:16px;background:#A7AA8C;color:#1C1C1C;text-align:center;font:700 28px/1.2 Courier New,monospace;letter-spacing:6px;">${code}</p>`;
        return this.sendEmail(
            email,
            `${title} · Rhymo`,
            this.renderEmail(title, instruction, codeBlock + `<p style="margin:0;color:#A7AA8C;font-size:14px;">${expiry}</p>`, ignore),
            `Rhymo\n\n${title}\n${instruction}\n\n${code}\n\n${expiry}\n${ignore}`
        );
    }

    async sendWelcomeEmail(email) {
        const title = 'Welcome to Rhymo';
        const message = 'Your account is ready. Open Rhymo to get started.';
        return this.sendEmail(email, title, this.renderEmail(title, message), `${title}\n\n${message}`);
    }

    renderEmail(title, message, content = '', footer = '') {
        return `<!doctype html>
<html lang="en" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <title>${title} · Rhymo</title>
</head>
<body bgcolor="#1C1C1C" style="margin:0;background:#1C1C1C;color:#EBE4DA;font:16px/1.6 Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#1C1C1C">
        <tr><td align="center" style="padding:32px 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:440px;">
                <tr><td style="padding:0 0 16px;color:#A7AA8C;font-size:20px;font-weight:700;">Rhymo</td></tr>
                <tr><td bgcolor="#252823" style="padding:28px;border:1px solid #3A3E34;border-radius:16px;color:#EBE4DA;">
                    <h1 style="margin:0 0 10px;font-size:28px;line-height:1.2;">${title}</h1>
                    <p style="margin:0;color:#EBE4DA;">${message}</p>
                    ${content}
                </td></tr>
                <tr><td style="padding:16px 0 0;color:#A7AA8C;font-size:13px;">${footer}</td></tr>
            </table>
        </td></tr>
    </table>
</body>
</html>`;
    }

    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }
}

export default new EmailService();
