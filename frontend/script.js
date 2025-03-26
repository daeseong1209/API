const API_BASE_URL = "http://localhost:3000";

// 로그인 상태 체크 및 네비게이션 메뉴 업데이트
function updateAuthButtons() {
    const authButtons = document.getElementById('authButtons');
    if (!authButtons) return;

    const token = localStorage.getItem('token');
    if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        authButtons.innerHTML = `
            <span style="color: var(--gray); font-size: 13px;">${payload.email}</span>
            <a href="mypage.html">마이페이지</a>
            <a href="#" onclick="logout()">로그아웃</a>
        `;
    } else {
        authButtons.innerHTML = `
            <a href="login.html">로그인</a>
            <a href="createUser.html">회원가입</a>
        `;
    }
}

// 로그아웃
function logout() {
    localStorage.removeItem('token');
    window.location.href = 'index.html';
}

// 게시글 목록 표시
async function displayArticles() {
    const articlesList = document.getElementById('articles');
    if (!articlesList) return;

    try {
        const response = await fetch(`${API_BASE_URL}/articles`);
        const articles = await response.json();
        
        articlesList.innerHTML = articles.map((article, index) => `
            <div class="article-item">
                <span class="article-number">${articles.length - index}</span>
                <a href="#" class="article-title">${article.title}</a>
                <div class="article-info">
                    <span>${new Date(article.created_at).toLocaleString('ko-KR', {
                        year: '2-digit',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error("게시글 가져오기 에러:", error);
        articlesList.innerHTML = "<div class='article-item'>게시글을 불러오지 못했습니다.</div>";
    }
}

// 로그인 폼 처리
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('token', data.token);
                window.location.href = 'index.html';
            } else {
                document.getElementById('message').innerText = '로그인에 실패했습니다.';
            }
        } catch (error) {
            console.error("로그인 에러:", error);
        }
    });
}

// 회원가입 폼 처리
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const passwordConfirm = document.getElementById('regPasswordConfirm').value;
        const messageElem = document.getElementById('regMessage');
        
        if (password !== passwordConfirm) {
            messageElem.innerText = '비밀번호가 일치하지 않습니다.';
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            if (response.ok) {
                alert('회원가입이 완료되었습니다.');
                window.location.href = 'login.html';
            } else {
                const text = await response.text();
                messageElem.innerText = text;
            }
        } catch (error) {
            console.error("회원가입 에러:", error);
            messageElem.innerText = '회원가입 중 오류가 발생했습니다.';
        }
    });
}

// 글쓰기 폼 처리
const createForm = document.getElementById('createForm');
if (createForm) {
    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('title').value;
        const content = document.getElementById('content').value;
        const token = localStorage.getItem('token');

        if (!token) {
            alert('로그인이 필요합니다.');
            window.location.href = 'login.html';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/articles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, content })
            });

            if (response.ok) {
                alert('게시글이 작성되었습니다.');
                window.location.href = 'index.html';
            } else {
                const data = await response.json();
                document.getElementById('message').innerText = data.error;
            }
        } catch (error) {
            console.error("게시글 작성 에러:", error);
        }
    });
}

// 내 게시글 목록 표시
async function displayMyArticles() {
    const myArticlesList = document.getElementById('myArticles');
    if (!myArticlesList) return;

    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/articles`);
        const articles = await response.json();
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        myArticlesList.innerHTML = articles
            .map((article, index) => `
                <div class="article-item">
                    <span class="article-number">${articles.length - index}</span>
                    <a href="#" class="article-title">${article.title}</a>
                    <div class="article-info">
                        <span>${new Date(article.created_at).toLocaleString('ko-KR', {
                            year: '2-digit',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}</span>
                        <button onclick="deleteArticle(${article.id})" class="btn">삭제</button>
                    </div>
                </div>
            `).join('');
    } catch (error) {
        console.error("게시글 가져오기 에러:", error);
    }
}

// 게시글 삭제
async function deleteArticle(id) {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_BASE_URL}/articles/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            alert('게시글이 삭제되었습니다.');
            displayMyArticles();
        } else {
            alert('게시글 삭제에 실패했습니다.');
        }
    } catch (error) {
        console.error("게시글 삭제 에러:", error);
    }
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
    updateAuthButtons();
    displayArticles();
    displayMyArticles();
});