const path = require("path"); // eslint-disable-line @typescript-eslint/no-var-requires

module.exports = {
  outputDir: "dist/website",
  pages: {
    app: {
      entry: "src/website/main.ts",
      template: "public/index.html",
    },
  },
  configureWebpack: {
    resolve: {
      alias: {
        "@": path.join(__dirname, "src/website"),
      },
    },
  },
};
