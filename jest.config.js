module.exports = {
  preset: "@vue/cli-plugin-unit-jest/presets/typescript-and-babel",
  moduleNameMapper: {
    "@/(.*)$": "<rootDir>/src/website/$1",
  },
  moduleFileExtensions: ["js", "ts", "json", "vue"],
  transform: {
    ".*\\.(vue)$": "vue-jest",
    "^.+\\.tsx?$": "ts-jest",
  },
  testURL: "http://localhost/",
};
