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

export const initDb = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      home_location TEXT,
      work_location TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
}

export const createUser = async ({ email, passwordHash, homeLocation, workLocation }) => {
  const now = new Date().toISOString()
  const result = await run(
    `INSERT INTO users (email, password_hash, home_location, work_location, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
    ,
    [email, passwordHash, homeLocation || null, workLocation || null, now, now]
  )

  return getUserById(result.id)
}

export const getUserByEmail = (email) => get(
  `SELECT id, email, password_hash, home_location, work_location, created_at, updated_at
   FROM users WHERE email = ?`,
  [email]
)

export const getUserById = (id) => get(
  `SELECT id, email, password_hash, home_location, work_location, created_at, updated_at
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
