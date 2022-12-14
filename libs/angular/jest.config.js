const { pathsToModuleNameMapper } = require("ts-jest");

const { compilerOptions } = require("../shared/tsconfig.libs");

const sharedConfig = require("../../libs/shared/jest.config.base");

module.exports = {
  ...sharedConfig,
  displayName: "libs/angular tests",
  preset: "jest-preset-angular",
  setupFilesAfterEnv: ["<rootDir>/test.setup.ts"],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions?.paths || {}, {
    prefix: "<rootDir>/",
  }),
  globals: {
    "ts-jest": {
      ...sharedConfig.globals["ts-jest"],
      astTransformers: {
        before: ["<rootDir>/../shared/es2020-transformer.ts"],
      },
    },
  },
};
