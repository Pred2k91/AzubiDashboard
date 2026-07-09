// Notfall-Werkzeug: setzt das Passwort eines Kontos zurück, ohne dass Login/SMTP nötig ist.
// Nutzung: docker compose exec backend node src/scripts/resetPassword.js <email> <neues-passwort>
const bcrypt = require('bcryptjs')
const { getDb, initDb } = require('../db/init')

const [, , email, newPassword] = process.argv

if (!email || !newPassword) {
  console.error('Nutzung: node src/scripts/resetPassword.js <email> <neues-passwort>')
  process.exit(1)
}
if (newPassword.length < 8) {
  console.error('Passwort muss mindestens 8 Zeichen haben')
  process.exit(1)
}

initDb()
const db = getDb()
const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
if (!user) {
  console.error(`Kein Konto mit E-Mail ${email} gefunden`)
  process.exit(1)
}

const hash = bcrypt.hashSync(newPassword, 10)
db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, active = 1 WHERE id = ?').run(hash, user.id)
db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id)

console.log(`Passwort für ${email} wurde zurückgesetzt. Beim nächsten Login muss es geändert werden.`)
