import nodemailer from 'nodemailer';

class EmailService {
    constructor() {
        this.smtp2goApiKey = process.env.SMTP2GO_API_KEY || 'api-92185494F7EF46419713E65A00EE34B9';
        this.fromEmail = process.env.FROM_EMAIL || 'noreply@rhymo.com';
        this.fromName = process.env.FROM_NAME || 'Rhymo Team';
        this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        
        // Configure SMTP2GO transporter
        this.transporter = nodemailer.createTransport({
            host: 'mail.smtp2go.com',
            port: 2525, // SMTP2GO SMTP port
            secure: false, // true for 465, false for other ports
            auth: {
                user: this.smtp2goApiKey,
                pass: this.smtp2goApiKey
            },
            tls: {
                rejectUnauthorized: false
            }
        });
    }

    async sendEmail(to, subject, html, text = null) {
        try {
            const mailOptions = {
                from: `"${this.fromName}" <${this.fromEmail}>`,
                to: to,
                subject: subject,
                html: html,
                text: text || this.stripHtml(html)
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Email sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    async sendPasswordResetEmail(email, resetCode, userName = 'User') {
        const subject = 'کد بازیابی رمز عبور - Rhymo';
        const html = `
            <!DOCTYPE html>
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>بازیابی رمز عبور</title>
                <style>
                    body { font-family: 'Tahoma', Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .code { background: #fff; border: 2px solid #667eea; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #667eea; }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                    .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>بازیابی رمز عبور</h1>
                        <p>سامانه شعر و قافیه</p>
                    </div>
                    <div class="content">
                        <p>سلام ${userName}،</p>
                        <p>درخواست بازیابی رمز عبور برای حساب کاربری شما دریافت شده است.</p>
                        <p>کد بازیابی شما:</p>
                        
                        <div class="code">
                            ${resetCode}
                        </div>
                        
                        <div class="warning">
                            <strong>توجه:</strong> این کد فقط تا ۱۰ دقیقه معتبر است.
                        </div>
                        
                        <p>اگر شما این درخواست را نکرده‌اید، این ایمیل را نادیده بگیرید.</p>
                        
                        <p>با تشکر،<br>تیم Rhymo</p>
                    </div>
                    <div class="footer">
                        <p>این ایمیل به صورت خودکار ارسال شده است. لطفاً به آن پاسخ ندهید.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail(email, subject, html);
    }

    async sendWelcomeEmail(email, userName) {
        const subject = 'خوش آمدید به Rhymo';
        const html = `
            <!DOCTYPE html>
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>خوش آمدید</title>
                <style>
                    body { font-family: 'Tahoma', Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>خوش آمدید!</h1>
                        <p>سامانه شعر و قافیه</p>
                    </div>
                    <div class="content">
                        <p>سلام ${userName}،</p>
                        <p>به Rhymo خوش آمدید! ثبت نام شما با موفقیت انجام شد.</p>
                        <p>حالا می‌توانید از تمام امکانات سامانه شعر و قافیه استفاده کنید:</p>
                        <ul>
                            <li>جستجوی کلمات و قافیه‌ها</li>
                            <li>مدیریت کلمات شخصی</li>
                            <li>دسترسی به دایره‌المعارف شعر</li>
                        </ul>
                        
                        <div style="text-align: center;">
                            <a href="${this.frontendUrl}" class="button">شروع کار</a>
                        </div>
                        
                        <p>اگر سوالی دارید، با ما در تماس باشید.</p>
                        
                        <p>با تشکر،<br>تیم Rhymo</p>
                    </div>
                    <div class="footer">
                        <p>این ایمیل به صورت خودکار ارسال شده است. لطفاً به آن پاسخ ندهید.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail(email, subject, html);
    }

    async sendEmailVerification(email, verificationCode, userName) {
        const subject = 'کد تایید ایمیل - Rhymo';
        const html = `
            <!DOCTYPE html>
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>تایید ایمیل</title>
                <style>
                    body { font-family: 'Tahoma', Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .code { background: #fff; border: 2px solid #667eea; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #667eea; }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                    .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>تایید ایمیل</h1>
                        <p>سامانه شعر و قافیه</p>
                    </div>
                    <div class="content">
                        <p>سلام ${userName}،</p>
                        <p>لطفاً ایمیل خود را تایید کنید تا حساب کاربری شما فعال شود.</p>
                        <p>کد تایید شما:</p>
                        
                        <div class="code">
                            ${verificationCode}
                        </div>
                        
                        <div class="warning">
                            <strong>توجه:</strong> این کد فقط تا ۱۰ دقیقه معتبر است.
                        </div>
                        
                        <p>با تشکر،<br>تیم Rhymo</p>
                    </div>
                    <div class="footer">
                        <p>این ایمیل به صورت خودکار ارسال شده است. لطفاً به آن پاسخ ندهید.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        return await this.sendEmail(email, subject, html);
    }

    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }
}

export default new EmailService();
