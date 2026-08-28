// .prettierrc.cjs
module.exports = {
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindConfig: './tailwind.config.js',
  // 一行最多 80 字元
  printWidth: 120,
  // 使用 2 個空格縮排
  tabWidth: 4,
  // 不使用縮排符，而使用空格
  useTabs: false,
  // 行尾需要有分號
  semi: true,
  // 使用單引號
  singleQuote: true,
  // 物件的 key 僅在必要時用引號
  quoteProps: "preserve",
  // 末尾不需要逗號
  trailingComma: "none",
  // 大括號內的首尾需要空格
  bracketSpacing: true,
  // 箭頭函數，只有一個參數的時候，也需要括號
  arrowParens: "always",
  // 每個文件格式化的範圍是文件的全部內容
  rangeStart: 0,
  rangeEnd: Infinity,
  // 不需要寫文件開頭的 @prettier
  requirePragma: false,
  // 不需要自動在文件開頭插入 @prettier
  insertPragma: false,
  // 使用預設的折行標準
  proseWrap: "preserve",
  // 根據顯示樣式決定 html 要不要折行
  htmlWhitespaceSensitivity: "css",
  // 換行符使用 crlf
  endOfLine: "crlf",
};
