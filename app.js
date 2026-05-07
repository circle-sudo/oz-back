// express의 부트스트랩 파일
import express from "express";

const app = express();
const PORT = 3000;

app.listen(PORT, () => {
  console.log("Server is running on port 3000" + PORT);
});