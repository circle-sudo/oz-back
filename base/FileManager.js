const fs = require("fs");
const path = require("path");
const os = require("os");

const filePath = path.join(__dirname, "..", "files");
console.log(filePath); // /Users/oz/Documents/oz-back/files

function createFile(fileName, content) {
  console.log(fileName);
  console.log(content);
  fs.writeFileSync(path.join(filePath, fileName), content);
}

function testCreateFiles() {
  createFile("hello.txt", "Hello, World! Good Morning!");
  createFile("hello2.txt", "Hello, World!2 Good Morning!");
  createFile("hello3.txt", "Hello, World!3 Good Morning!");

  const osPlatform = os.platform();
  const osFreemem = os.freemem();
  const osTotalmem = os.totalmem();
  const osInfo = `Platform: ${osPlatform}\n
  Free Memory: ${osFreemem}\n
  Total Memory: ${osTotalmem}`;

  createFile("os.txt", osInfo);
}

module.exports = { createFile, testCreateFiles };