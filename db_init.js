const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// 데이터베이스 파일 경로
const dbPath = path.join(__dirname, 'database.db');

// 기존 데이터베이스 파일이 있다면 삭제
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

// 새로운 데이터베이스 연결
const db = new sqlite3.Database(dbPath);

// 스키마 파일 읽기
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

// 트랜잭션으로 스키마 실행
db.serialize(() => {
  db.run('BEGIN TRANSACTION');
  
  // 스키마 실행
  schema.split(';').forEach((statement) => {
    if (statement.trim()) {
      db.run(statement, (err) => {
        if (err) {
          console.error('Error executing statement:', err);
        }
      });
    }
  });
  
  db.run('COMMIT');
});

// 데이터베이스 연결 종료
db.close((err) => {
  if (err) {
    console.error('Error closing database:', err);
  } else {
    console.log('Database initialized successfully!');
  }
});

// SQLite DB 연결
const db = new sqlite3.Database('./database.db', (err) => {
  if (err) return console.error("DB 연결 에러:", err.message);
  console.log('✅ DB 연결 성공');

  // 외래키 제약 조건 활성화
  db.run("PRAGMA foreign_keys = ON");
});

// users 테이블 생성
function initUsersTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error("❌ users 테이블 생성 에러:", err);
    } else {
      console.log("✅ 테이블 준비 완료 (users)");
    }
  });
}

// articles 테이블 생성 (user_id 외래키 포함)
function initArticlesTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error("❌ articles 테이블 생성 에러:", err);
    } else {
      console.log("✅ 테이블 준비 완료 (articles)");
    }
  });
}

// comments 테이블 생성 (user_id, article_id 외래키 포함)
function initCommentsTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      article_id INTEGER,
      user_id INTEGER,
      FOREIGN KEY (article_id) REFERENCES articles(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) {
      console.error("❌ comments 테이블 생성 에러:", err);
    } else {
      console.log("✅ 테이블 준비 완료 (comments)");
    }
  });
}

// 모든 테이블 초기화 실행
initUsersTable();
initArticlesTable();
initCommentsTable();




