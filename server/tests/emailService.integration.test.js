const nodemailer = require('nodemailer');
const EmailService = require('../services/emailService');

test('email service produces a MIME message through upgraded Nodemailer', async () => {
    const service = new EmailService({ enabled: false, from: 'subscriptions@example.com' });
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
    service.transporter = { sendMail: jest.fn(mail => transport.sendMail(mail)) };
    const result = await service.sendMail({
        to: 'recipient@example.com', subject: 'Renewal reminder',
        html: '<p>Renewal due</p>', text: 'Renewal due',
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toBeTruthy();
    const info = await service.transporter.sendMail.mock.results[0].value;
    expect(info.message.toString()).toContain('Subject: Renewal reminder');
    expect(info.message.toString()).toContain('Renewal due');
});
