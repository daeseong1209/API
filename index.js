const express = require('express');
const app = express();
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});

dict = 

app.get('/test', (req, res) => {
    console.log(req.query)
    res.send("ok");
});