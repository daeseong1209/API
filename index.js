const express = require('express');
const app = express();
// cors 문제해결
const cors = require('cors');
app.use(cors());
// json으로 된 post의 바디를 읽기 위해 필요
app.use(express.json())
const jwt = require('jsonwebtoken');
const SECRET_KEY = "your_secret_key"; // 실제 서비스에선 더 복잡하고 안전하게!
const PORT = 3000;
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

//db 연결
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.db');

// 인증 미들웨어
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: '인증 헤더가 없습니다.' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
    }

    // 인증 성공 시 decoded 안에 있는 사용자 정보 req에 저장
    req.user = decoded;
    next();
  });
};

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'public/uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// 게시판 관련 엔드포인트 (인증 불필요)
app.get('/boards', (req, res) => {
  db.all("SELECT * FROM boards", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/boards/:id', (req, res) => {
  const boardId = req.params.id;
  db.get("SELECT * FROM boards WHERE id = ?", [boardId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: "게시판을 찾을 수 없습니다." });
    }
    res.json(row);
  });
});

// 게시글 관련 엔드포인트
// 게시글 목록 조회 (인증 불필요)
app.get('/articles', (req, res) => {
  const { board_id, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  let query = `
    SELECT 
      a.*, 
      u.email,
      COUNT(c.id) as comment_count 
    FROM articles a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN comments c ON a.id = c.article_id
  `;
  
  if (board_id) {
    query += " WHERE a.board_id = ?";
  }
  
  query += " GROUP BY a.id ORDER BY a.created_at DESC LIMIT ? OFFSET ?";
  
  const params = board_id ? [board_id, limit, offset] : [limit, offset];
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 게시글 상세 조회 (인증 불필요)
app.get('/articles/:id', (req, res) => {
  const articleId = req.params.id;
  
  const query = `
    SELECT 
      a.*, 
      u.email,
      COUNT(DISTINCT c.id) as comment_count,
      COUNT(DISTINCT l.id) as like_count
    FROM articles a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN comments c ON a.id = c.article_id
    LEFT JOIN likes l ON a.id = l.article_id
    WHERE a.id = ?
    GROUP BY a.id
  `;
  
  db.get(query, [articleId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });
    }
    res.json(row);
  });
});

// 게시글 작성 (인증 필요)
app.post('/articles', authMiddleware, upload.array('files', 5), (req, res) => {
  const { title, content, board_id } = req.body;
  const userId = req.user.id;
  
  const query = `
    INSERT INTO articles (title, content, user_id, board_id, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `;
  
  db.run(query, [title, content, userId, board_id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const articleId = this.lastID;
    
    // 파일 정보 저장
    if (req.files && req.files.length > 0) {
      const fileQuery = `
        INSERT INTO files (article_id, filename, original_name, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `;
      
      req.files.forEach(file => {
        db.run(fileQuery, [articleId, file.filename, file.originalname]);
      });
    }
    
    res.status(201).json({
      id: articleId,
      title,
      content,
      user_id: userId,
      board_id
    });
  });
});

// 게시글 수정 (인증 필요)
app.put('/articles/:id', authMiddleware, upload.array('files', 5), (req, res) => {
  const articleId = req.params.id;
  const { title, content } = req.body;
  const userId = req.user.id;
  
  // 권한 확인
  db.get("SELECT user_id FROM articles WHERE id = ?", [articleId], (err, article) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!article) {
      return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });
    }
    if (article.user_id !== userId) {
      return res.status(403).json({ error: "게시글을 수정할 권한이 없습니다." });
    }
    
    // 게시글 업데이트
    const query = `
      UPDATE articles 
      SET title = ?, content = ?, updated_at = datetime('now')
      WHERE id = ?
    `;
    
    db.run(query, [title, content, articleId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // 새 파일 정보 저장
      if (req.files && req.files.length > 0) {
        const fileQuery = `
          INSERT INTO files (article_id, filename, original_name, created_at)
          VALUES (?, ?, ?, datetime('now'))
        `;
        
        req.files.forEach(file => {
          db.run(fileQuery, [articleId, file.filename, file.originalname]);
        });
      }
      
      res.json({ message: "게시글이 수정되었습니다." });
    });
  });
});

// 게시글 삭제 (인증 필요)
app.delete('/articles/:id', authMiddleware, (req, res) => {
  const articleId = req.params.id;
  const userId = req.user.id;
  
  // 권한 확인
  db.get("SELECT user_id FROM articles WHERE id = ?", [articleId], (err, article) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!article) {
      return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });
    }
    if (article.user_id !== userId) {
      return res.status(403).json({ error: "게시글을 삭제할 권한이 없습니다." });
    }
    
    // 파일 삭제
    db.all("SELECT filename FROM files WHERE article_id = ?", [articleId], (err, files) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      files.forEach(file => {
        const filePath = path.join('public/uploads', file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      
      // 데이터베이스에서 게시글 삭제
      db.run("DELETE FROM articles WHERE id = ?", [articleId], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: "게시글이 삭제되었습니다." });
      });
    });
  });
});

// 댓글 관련 엔드포인트
// 댓글 목록 조회 (인증 불필요)
app.get('/articles/:id/comments', (req, res) => {
  const articleId = req.params.id;
  const query = `
    SELECT 
      c.*, 
      u.email
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.article_id = ?
    ORDER BY c.created_at ASC
  `;
  
  db.all(query, [articleId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 댓글 작성 (인증 필요)
app.post('/articles/:id/comments', authMiddleware, (req, res) => {
  const articleId = req.params.id;
  const { content } = req.body;
  const userId = req.user.id;
  
  const query = `
    INSERT INTO comments (content, user_id, article_id, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `;
  
  db.run(query, [content, userId, articleId], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(201).json({
      id: this.lastID,
      content,
      user_id: userId,
      article_id: articleId
    });
  });
});

// 댓글 수정 (인증 필요)
app.put('/comments/:id', authMiddleware, (req, res) => {
  const commentId = req.params.id;
  const { content } = req.body;
  const userId = req.user.id;
  
  // 권한 확인
  db.get("SELECT user_id FROM comments WHERE id = ?", [commentId], (err, comment) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!comment) {
      return res.status(404).json({ error: "댓글을 찾을 수 없습니다." });
    }
    if (comment.user_id !== userId) {
      return res.status(403).json({ error: "댓글을 수정할 권한이 없습니다." });
    }
    
    const query = `
      UPDATE comments 
      SET content = ?, updated_at = datetime('now')
      WHERE id = ?
    `;
    
    db.run(query, [content, commentId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: "댓글이 수정되었습니다." });
    });
  });
});

// 댓글 삭제 (인증 필요)
app.delete('/comments/:id', authMiddleware, (req, res) => {
  const commentId = req.params.id;
  const userId = req.user.id;
  
  // 권한 확인
  db.get("SELECT user_id FROM comments WHERE id = ?", [commentId], (err, comment) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!comment) {
      return res.status(404).json({ error: "댓글을 찾을 수 없습니다." });
    }
    if (comment.user_id !== userId) {
      return res.status(403).json({ error: "댓글을 삭제할 권한이 없습니다." });
    }
    
    db.run("DELETE FROM comments WHERE id = ?", [commentId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: "댓글이 삭제되었습니다." });
    });
  });
});

// 좋아요 관련 엔드포인트 (인증 필요)
app.post('/articles/:id/like', authMiddleware, (req, res) => {
  const articleId = req.params.id;
  const userId = req.user.id;
  
  // 이미 좋아요를 눌렀는지 확인
  db.get("SELECT id FROM likes WHERE article_id = ? AND user_id = ?", [articleId, userId], (err, like) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (like) {
      // 좋아요 취소
      db.run("DELETE FROM likes WHERE article_id = ? AND user_id = ?", [articleId, userId], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: "좋아요가 취소되었습니다." });
      });
    } else {
      // 좋아요 추가
      db.run("INSERT INTO likes (article_id, user_id, created_at) VALUES (?, ?, datetime('now'))", [articleId, userId], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: "좋아요가 추가되었습니다." });
      });
    }
  });
});

// 사용자 관련 엔드포인트
// 회원가입 (인증 불필요)
app.post('/users', (req, res) => {
  const { email, password, nickname } = req.body;
  
  if (!email || !password || !nickname) {
    return res.status(400).json({ error: "이메일, 비밀번호, 닉네임을 모두 입력해주세요." });
  }
  
  // 비밀번호 해싱
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      return res.status(500).json({ error: "비밀번호 암호화 중 오류가 발생했습니다." });
    }
    
    const query = `
      INSERT INTO users (email, password, nickname, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `;
    
    db.run(query, [email, hashedPassword, nickname], function(err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          return res.status(409).json({ error: "이미 존재하는 이메일입니다." });
        }
        return res.status(500).json({ error: err.message });
      }
      
      res.status(201).json({
        id: this.lastID,
        email,
        nickname
      });
    });
  });
});

// 로그인 (인증 불필요)
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: "이메일과 비밀번호를 입력해주세요." });
  }
  
  const query = `SELECT * FROM users WHERE email = ?`;
  
  db.get(query, [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!user) {
      return res.status(404).json({ error: "존재하지 않는 이메일입니다." });
    }
    
    bcrypt.compare(password, user.password, (err, result) => {
      if (err) {
        return res.status(500).json({ error: "비밀번호 확인 중 오류가 발생했습니다." });
      }
      
      if (!result) {
        return res.status(401).json({ error: "비밀번호가 일치하지 않습니다." });
      }
      
      const token = jwt.sign(
        { id: user.id, email: user.email, nickname: user.nickname },
        SECRET_KEY,
        { expiresIn: '1h' }
      );
      
      res.json({
        message: "로그인 성공!",
        token,
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname
        }
      });
    });
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});