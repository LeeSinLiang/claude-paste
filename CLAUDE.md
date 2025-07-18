# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension called "Claude Paste" designed to save images temporarily from the clipboard to the local project for easy file reference with Claude. The project is currently in early development (v0.0.1) with basic scaffolding.

## Development Commands

- **Build**: `npm run compile` - Compiles TypeScript and runs type checking and linting
- **Watch mode**: `npm run watch` - Runs esbuild and TypeScript compiler in watch mode
- **Type checking**: `npm run check-types` - Runs TypeScript compiler without emitting files
- **Linting**: `npm run lint` - Runs ESLint on the src directory
- **Package for production**: `npm run package` - Creates optimized build for distribution
- **Testing**: `npm run test` - Runs VS Code extension tests using vscode-test

## Architecture

### Build System
- Uses **esbuild** for fast bundling and compilation (configured in `esbuild.js`)
- TypeScript configuration targets ES2022 with Node16 modules
- Bundle output: `dist/extension.js` (excluded `vscode` as external dependency)
- Source maps enabled in development, minification in production

### Code Structure
- **Entry point**: `src/extension.ts` - Contains `activate()` and `deactivate()` functions
- **Tests**: `src/test/extension.test.ts` - Uses Mocha test framework
- **Single command**: `claude-paste.helloWorld` (placeholder implementation)

### Configuration
- **ESLint**: Modern flat config with TypeScript support
- **TypeScript**: Strict mode enabled, targeting ES2022
- **VS Code API**: Minimum version 1.102.0

## Development Notes

The extension currently only has a basic "Hello World" command. The actual clipboard-to-file functionality described in the package.json description has not yet been implemented.