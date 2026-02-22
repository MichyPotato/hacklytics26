import initSqlJs from 'sql.js'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dbPath = path.join(__dirname, 'app.sqlite')
let db = null
let SQL = null

// Initialize sql.js and load database from disk
const initializeSqlJs = async () => {
  if (SQL) return SQL
  SQL = await initSqlJs()
  return SQL
}

const loadDatabase = async () => {
  await initializeSqlJs()
  
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }
  return db
}

const saveDatabase = () => {
  if (!db) return
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(dbPath, buffer)
}

const run = (sql, params = []) => {
  try {
    db.run(sql, params)
    saveDatabase()
    return Promise.resolve({ changes: db.getRowsModified() })
  } catch (error) {
    return Promise.reject(error)
  }
}

const getLastInsertRowId = () => {
  try {
    const result = db.exec('SELECT last_insert_rowid() as id')
    return result.length > 0 ? result[0].values[0][0] : null
  } catch (error) {
    return null
  }
}

const get = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql)
    stmt.bind(params)
    const result = stmt.step() ? stmt.getAsObject() : undefined
    stmt.free()
    return Promise.resolve(result)
  } catch (error) {
    return Promise.reject(error)
  }
}

const all = (sql, params = []) => {
  try {
    const stmt = db.prepare(sql)
    stmt.bind(params)
    const result = []
    while (stmt.step()) {
      result.push(stmt.getAsObject())
    }
    stmt.free()
    return Promise.resolve(result)
  } catch (error) {
    return Promise.reject(error)
  }
}

export const initDb = async () => {
  await loadDatabase()
  
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
  await run(
    `INSERT INTO users (email, password_hash, home_location, work_location, preferred_language, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    ,
    [email, passwordHash, homeLocation || null, workLocation || null, preferredLanguage || 'en', now, now]
  )

  const lastId = getLastInsertRowId()
  return getUserById(lastId)
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
