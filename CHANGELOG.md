# [3.1.0](https://github.com/matheusrezende/codeplot/compare/v3.0.0...v3.1.0) (2025-06-29)


### Features

* **mcp:** add core modules for MCP integration ([4711640](https://github.com/matheusrezende/codeplot/commit/47116409f5fc414a827f98dfe602474ff16d9bb9))
* **prd:** add PRDAgent and PRDGeneratorAgent ([8dbf33d](https://github.com/matheusrezende/codeplot/commit/8dbf33df8db87ac8c5b33ee233423dd1f6857681))
* **ui:** add workflow selection screen ([045d25c](https://github.com/matheusrezende/codeplot/commit/045d25c1fdb3f1786ea47956234360cef9c7206b))

# [3.0.0](https://github.com/matheusrezende/codeplot/compare/v2.0.0...v3.0.0) (2025-06-29)


### Bug Fixes

* fixes issues in rendering options ([d88b498](https://github.com/matheusrezende/codeplot/commit/d88b49888dafc9c6245f68a2b461a51a39e6e142))


### Features

* convert all source files from JavaScript to TypeScript ([07122eb](https://github.com/matheusrezende/codeplot/commit/07122eb2bc217b29c973bdf64bbd45789a48fe95))
* migrate to TypeScript build system ([f6ee402](https://github.com/matheusrezende/codeplot/commit/f6ee402610356c3ba8220fb845b4b3690aabe779))
* update CLI launcher to execute TypeScript code ([fb7c6f8](https://github.com/matheusrezende/codeplot/commit/fb7c6f87f15d514bc335e48b9964dcdb557438f0))


### BREAKING CHANGES

* Project now requires TypeScript compilation

# [2.0.0](https://github.com/matheusrezende/codeplot/compare/v1.5.2...v2.0.0) (2025-06-28)


### Bug Fixes

* resolve LangChain prompt template and repomix parsing issues ([adbf824](https://github.com/matheusrezende/codeplot/commit/adbf824f0af8335d564483e747b4b69f25f7fc6d))


### Features

* add React-based terminal UI with Ink ([3aec80b](https://github.com/matheusrezende/codeplot/commit/3aec80b2757c9f782b8864f73cb72a9316dbbdf8))
* implement Agent-based architecture with LangChain ([958e10f](https://github.com/matheusrezende/codeplot/commit/958e10f6ebe582b8eb3567ec182a21a9706fff4c))
* prepare package for npm publishing with tsx runtime ([ccec2fe](https://github.com/matheusrezende/codeplot/commit/ccec2fe91873d4953d2cec5e407bb8387a4b6ec8))


### BREAKING CHANGES

* Package now requires tsx at runtime for JSX support
* Application now requires tsx runtime for JSX components

## [1.5.2](https://github.com/matheusrezende/codeplot/compare/v1.5.1...v1.5.2) (2025-06-27)


### Bug Fixes

* sync version from package.json to package-github.json before publishing ([c47b618](https://github.com/matheusrezende/codeplot/commit/c47b618f949bd3636f4d0d16c214301d611bebde))

## [1.5.1](https://github.com/matheusrezende/codeplot/compare/v1.5.0...v1.5.1) (2025-06-27)


### Bug Fixes

* use GH_TOKEN for GitHub Packages authentication ([2289033](https://github.com/matheusrezende/codeplot/commit/228903306fe766ae5cef73272f59b27c256b8fc2))

# [1.5.0](https://github.com/matheusrezende/codeplot/compare/v1.4.0...v1.5.0) (2025-06-27)


### Bug Fixes

* prevent duplicate ADR template files from adr-tools initialization ([a599955](https://github.com/matheusrezende/codeplot/commit/a59995591cea2362029e79b242e029f443672ac6))
* update workflow to use Personal Access Token for branch protection bypass ([15687a0](https://github.com/matheusrezende/codeplot/commit/15687a0c088a01eeb2548130430d578ac9aec50d))


### Features

* add GitHub Packages publishing support ([b718af4](https://github.com/matheusrezende/codeplot/commit/b718af457b972cff427e7d85784064b2927959c2))
* test GitHub Packages publishing setup ([fdc2973](https://github.com/matheusrezende/codeplot/commit/fdc297325a3f4c0580df1772584691b829111b66))

# [1.4.0](https://github.com/matheusrezende/codeplot/compare/v1.3.2...v1.4.0) (2025-06-27)


### Features

* add ADR review and modification options for completed sessions ([a3f2da0](https://github.com/matheusrezende/codeplot/commit/a3f2da0716981b1a0401422e8d33ae6ba69f74d1))

## [1.3.2](https://github.com/matheusrezende/codeplot/compare/v1.3.1...v1.3.2) (2025-06-27)


### Bug Fixes

* prevent resuming completed ADR sessions from restarting planning ([f8771d5](https://github.com/matheusrezende/codeplot/commit/f8771d57f12c5b814549d6ee7d6379e71cb978c1))

## [1.3.1](https://github.com/matheusrezende/codeplot/compare/v1.3.0...v1.3.1) (2025-06-27)


### Bug Fixes

* implement proper chat history tracking for session persistence ([29f5c6f](https://github.com/matheusrezende/codeplot/commit/29f5c6f8b8e58bc51b4da24ccab7267970430cea))

# [1.3.0](https://github.com/matheusrezende/codeplot/compare/v1.2.2...v1.3.0) (2025-06-27)


### Features

* add session persistence configuration ([76c36bc](https://github.com/matheusrezende/codeplot/commit/76c36bc57a22ca35a26ea6aafb7efb7731176085))
* add session state management to ChatSession ([88fc152](https://github.com/matheusrezende/codeplot/commit/88fc152ba050130ae788315084a449c3c450be7e))
* implement SessionManager for file-based session persistence ([e502d05](https://github.com/matheusrezende/codeplot/commit/e502d053cf7a647af4d7c2f996f3946be7e637e5))

## [1.2.2](https://github.com/matheusrezende/codeplot/compare/v1.2.1...v1.2.2) (2025-06-27)


### Bug Fixes

* remove maxOutputTokens limit to prevent AI response truncation ([d93eecc](https://github.com/matheusrezende/codeplot/commit/d93eecc907c06f941f0bfc6783b775526c8af773))

## [1.2.1](https://github.com/matheusrezende/codeplot/compare/v1.2.0...v1.2.1) (2025-06-27)


### Bug Fixes

* prevent adr-tools from hanging by setting non-interactive editor ([4819e30](https://github.com/matheusrezende/codeplot/commit/4819e30b4e341770777fe5ad1a23ee8c0871f43f))

# [1.2.0](https://github.com/matheusrezende/codeplot/compare/v1.1.0...v1.2.0) (2025-06-27)


### Features

* update default ADR path to match adr-tools standard ([e16ab5b](https://github.com/matheusrezende/codeplot/commit/e16ab5b560bed0be4ac948297b62c64848068ae3))

# [1.1.0](https://github.com/matheusrezende/codeplot/compare/v1.0.0...v1.1.0) (2025-06-27)


### Features

* enhance ADR generation and repo packaging with AI-driven improvements ([2ee0a9a](https://github.com/matheusrezende/codeplot/commit/2ee0a9ad5b0c64bacd1087a32573f95d25bd2df3))

# 1.0.0 (2025-06-27)


### Bug Fixes

* **ci:** add proper permissions for semantic-release ([8ca7a51](https://github.com/matheusrezende/codeplot/commit/8ca7a51ee611bab055107bf25c49e2997d58000a))
* **ci:** remove invalid cache parameter from volta-cli/action ([8b7371c](https://github.com/matheusrezende/codeplot/commit/8b7371c64e5ec40209c9326b1057e7bdb38988e3))
* **ci:** update Husky and commitlint for compatibility ([c486f02](https://github.com/matheusrezende/codeplot/commit/c486f02a625711f03f54db4ab429494d7e1410b6))
* improve feature name extraction logic ([aa7b8a7](https://github.com/matheusrezende/codeplot/commit/aa7b8a71f750cfc4c45342f0ed417f3ca613de6d))
* resolve linting issues and clean up unused code ([1ebefe6](https://github.com/matheusrezende/codeplot/commit/1ebefe6c269189751c7a74efe774aba30a242e0d))
* update repository URLS to use matheusrezende in readme and package.json ([b642e06](https://github.com/matheusrezende/codeplot/commit/b642e06d1816eda082b98671dbba072e8aee1c0f))


### Features

* add Volta for Node.js version management ([2f933c0](https://github.com/matheusrezende/codeplot/commit/2f933c08d457723f976f75e5d5ad57aaf2739229))
* Initialize Codeplot CLI tool with interactive feature planning and ADR generation ([4c2e7f6](https://github.com/matheusrezende/codeplot/commit/4c2e7f64148cd843d7ce5424dd16065b5cc3fa65))
* migrate to ESLint 9 flat config format ([48c536e](https://github.com/matheusrezende/codeplot/commit/48c536e4d7cec7e4f8eba9c8dfcaaee26f7a9e51))
* **security:** implement comprehensive security best practices ([cc051e3](https://github.com/matheusrezende/codeplot/commit/cc051e3890b79e76d1f25421f3a19d47ecdd28dd))
