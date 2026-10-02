module.exports = {
  extends: "expo",
  ignorePatterns: ["/dist/*"],
  rules: {
    "expo/use-dom-exports": "off",
    quotes: ["error", "double", { avoidEscape: true }],
    "jsx-quotes": ["error", "prefer-double"],
  },
};