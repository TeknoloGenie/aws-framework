/* eslint-disable no-magic-numbers */
module.exports = {
    "env": {
        "node": true,
        "es2021": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended"
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "plugins": [
        "@typescript-eslint"
    ],
    "rules": {
        "indent": ["error", 4],
        "quotes": ["error", "double"],
        "semi": ["error", "always"],
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": "error",
        "no-magic-numbers": ["error", { "ignore": [0, 1, -1] }],
        "no-trailing-spaces": "error",
        "eol-last": ["error", "always"]
    }
};
