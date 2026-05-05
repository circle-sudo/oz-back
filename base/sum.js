function main() {
  let a = 1;
  let b = 2;
  console.log(__dirname);

  console.log(a + b);

  function sum(a, b) {
    console.log(a);
    console.log(b);
    return a + b;
  }
  const c = sum(a, b);
  console.log(c);
}

module.exports = { main };