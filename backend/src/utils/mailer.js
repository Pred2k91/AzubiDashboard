const nodemailer = require('nodemailer')

let transporter = null

function isEnabled() {
  return process.env.MAIL_ENABLED === 'true'
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  }
  return transporter
}

// No-op solange MAIL_ENABLED nicht auf 'true' steht — Versandlogik ist vollständig
// vorbereitet, wird aber erst nach Konfiguration durch die IT aktiv.
async function sendMail({ to, cc, subject, text, html }) {
  if (!isEnabled()) {
    console.log(`[mailer] MAIL_ENABLED ist nicht aktiv — Mail an ${to} ("${subject}") wurde NICHT versendet.`)
    return { sent: false, reason: 'disabled' }
  }
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    ...(cc && cc.length ? { cc } : {}),
    subject,
    text,
    html,
  })
  return { sent: true }
}

module.exports = { sendMail, isEnabled }
