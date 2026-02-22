import sqlite3 from 'sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, 'app.sqlite')
const db = new sqlite3.Database(dbPath)

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onRun(err) {
    if (err) return reject(err)
    resolve({ id: this.lastID, changes: this.changes })
  })
})

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) return reject(err)
    resolve(row)
  })
})

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) return reject(err)
    resolve(rows)
  })
})

export const initDb = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      home_location TEXT,
      work_location TEXT,
      preferred_language TEXT DEFAULT 'en',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  
  // Migrate existing database to add preferred_language column if it doesn't exist
  try {
    const tableInfo = await all('PRAGMA table_info(users)')
    
    const hasLanguageColumn = tableInfo.some(col => col.name === 'preferred_language')
    
    if (!hasLanguageColumn) {
      console.log('Adding preferred_language column to users table...')
      await run('ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT \'en\'')
      console.log('Migration completed: preferred_language column added')
    }
  } catch (error) {
    console.error('Migration check failed:', error)
  }
}

export const createUser = async ({ email, passwordHash, homeLocation, workLocation, preferredLanguage }) => {
  const now = new Date().toISOString()
  const result = await run(
    `INSERT INTO users (email, password_hash, home_location, work_location, preferred_language, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    ,
    [email, passwordHash, homeLocation || null, workLocation || null, preferredLanguage || 'en', now, now]
  )

  return getUserById(result.id)
}

export const getUserByEmail = (email) => get(
  `SELECT id, email, password_hash, home_location, work_location, preferred_language, created_at, updated_at
   FROM users WHERE email = ?`,
  [email]
)

export const getUserById = (id) => get(
  `SELECT id, email, password_hash, home_location, work_location, preferred_language, created_at, updated_at
   FROM users WHERE id = ?`,
  [id]
)

export const updateUserLocations = async ({ id, homeLocation, workLocation }) => {
  const now = new Date().toISOString()
  await run(
    `UPDATE users
     SET home_location = ?, work_location = ?, updated_at = ?
     WHERE id = ?`,
    [homeLocation || null, workLocation || null, now, id]
  )

  return getUserById(id)
}

export const updateUserLanguage = async ({ id, preferredLanguage }) => {
  const now = new Date().toISOString()
  await run(
    `UPDATE users
     SET preferred_language = ?, updated_at = ?
     WHERE id = ?`,
    [preferredLanguage || 'en', now, id]
  )

  return getUserById(id)
}
