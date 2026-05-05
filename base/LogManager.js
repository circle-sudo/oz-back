const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "logs");
console.log(filePath); // /Users/oz/Documents/oz-back/logs

function getFileNameByDate() {
  const date = new Date().toISOString(); // 2026-05-04T01:36:17.350Z
  const dateArr = date.split("T"); // ["2026-05-04", "01:36:17.350Z"]
  const dateName = dateArr[0]; // 2026-05-04
  return `${dateName}.log`;
}

function isExistFile(fileName) {
  return fs.existsSync(path.join(filePath, fileName));
}

function getTime() {
  const date = new Date().toISOString(); // 2026-05-04T01:36:17.350Z
  const dateArr = date.split("T"); // ["2026-05-04", "01:36:17.350Z"]
  const time = dateArr[1]; // 01:36:17.350
  return time;
}

function getMessageContent(fileName, message) {
  const isExist = isExistFile(fileName);
  const time = getTime();
  return `${isExist ? "\n" : ""}[${time}] ${message}`;
}

function logMessage(message) {
  const fileName = getFileNameByDate();
  const messageContent = getMessageContent(fileName, message);
  fs.appendFileSync(path.join(filePath, fileName), messageContent);
}

module.exports = { logMessage };