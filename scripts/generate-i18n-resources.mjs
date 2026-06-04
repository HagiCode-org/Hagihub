import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  listLocaleDirectories,
  readYamlLocaleFile,
  resolveHagi18nConfig,
  walkYamlFiles,
} from '@hagicode/hagi18n';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, '..');
const defaultConfigPath = path.join(repoRoot, 'hagi18n.yaml');
const defaultGeneratedRoot = path.join(repoRoot, 'src/renderer/locales/generated-locales');
const ignoredLocaleDirectories = new Set(['generated-locales']);

function normalizeNames(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function replaceFileExtension(relativePath, extension) {
  return relativePath.replace(/\.(?:ya?ml)$/u, extension);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readGeneratedJsonFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  assert(isPlainObject(parsed), `Generated locale artifact must be a top-level mapping: ${path.relative(repoRoot, filePath)}`);
  return parsed;
}

async function walkJsonFiles(directory, prefix = '') {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = prefix ? path.posix.join(prefix, entry.name) : entry.name;
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await walkJsonFiles(absolutePath, relativePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(relativePath);
    }
  }

  return files;
}

async function resolveMetadata(options = {}) {
  const resolvedConfig = await resolveHagi18nConfig({
    cwd: repoRoot,
    configPath: options.configPath ?? defaultConfigPath,
  });

  return {
    localesRoot: path.resolve(options.localesRoot ?? resolvedConfig.localesRoot),
    generatedRoot: path.resolve(options.generatedRoot ?? defaultGeneratedRoot),
    baseLocale: resolvedConfig.baseLocale,
    expectedLocales: normalizeNames([resolvedConfig.baseLocale, ...resolvedConfig.targetLocales]),
  };
}

function resolveSourceLocaleDirectories(actualDirectories, expectedLocales) {
  const remaining = [];
  const unexpected = [];

  for (const directory of actualDirectories) {
    if (expectedLocales.includes(directory)) {
      remaining.push(directory);
      continue;
    }

    if (ignoredLocaleDirectories.has(directory)) {
      continue;
    }

    unexpected.push(directory);
  }

  assert.deepEqual(
    normalizeNames(unexpected),
    [],
    `Unexpected non-locale directories found under src/renderer/locales: ${unexpected.join(', ')}`,
  );

  return normalizeNames(remaining);
}

async function loadYamlLocaleTree(options = {}) {
  const metadata = await resolveMetadata(options);
  const { localesRoot, expectedLocales, baseLocale } = metadata;
  const actualLocales = resolveSourceLocaleDirectories(await listLocaleDirectories(localesRoot), expectedLocales);

  assert.deepEqual(
    actualLocales,
    expectedLocales,
    `Locale directories in ${path.relative(repoRoot, localesRoot)} must match hagi18n locale metadata`,
  );

  const baseLocaleFiles = normalizeNames(await walkYamlFiles(path.join(localesRoot, baseLocale)));
  const artifacts = [];

  for (const locale of expectedLocales) {
    const localeDirectory = path.join(localesRoot, locale);
    const actualFiles = normalizeNames(await walkYamlFiles(localeDirectory));
    assert.deepEqual(actualFiles, baseLocaleFiles, `${locale} YAML file paths must stay aligned with ${baseLocale}`);

    for (const relativePath of actualFiles) {
      const document = await readYamlLocaleFile(localesRoot, locale, relativePath);
      assert(
        isPlainObject(document.data),
        `Locale source ${locale}/${relativePath} must be a top-level mapping`,
      );

      artifacts.push({
        locale,
        relativePath: replaceFileExtension(relativePath, '.json'),
        data: document.data,
      });
    }
  }

  return {
    ...metadata,
    artifacts,
    fileCount: baseLocaleFiles.length,
  };
}

async function loadGeneratedLocaleTree(options = {}) {
  const { generatedRoot, expectedLocales } = await resolveMetadata(options);
  const actualLocales = normalizeNames(await listLocaleDirectories(generatedRoot));
  assert.deepEqual(
    actualLocales,
    expectedLocales,
    `Generated locale directories in ${path.relative(repoRoot, generatedRoot)} must match hagi18n locale metadata`,
  );

  const artifacts = [];

  for (const locale of expectedLocales) {
    const localeDirectory = path.join(generatedRoot, locale);
    const generatedFiles = normalizeNames(await walkJsonFiles(localeDirectory));

    for (const relativePath of generatedFiles) {
      artifacts.push({
        locale,
        relativePath,
        data: await readGeneratedJsonFile(path.join(localeDirectory, relativePath)),
      });
    }
  }

  return { generatedRoot, artifacts };
}

function collectParityErrors(expectedArtifacts, actualArtifacts) {
  const actualByKey = new Map(
    actualArtifacts.map((artifact) => [`${artifact.locale}:${artifact.relativePath}`, artifact]),
  );
  const errors = [];

  for (const artifact of expectedArtifacts) {
    const key = `${artifact.locale}:${artifact.relativePath}`;
    const actual = actualByKey.get(key);

    if (!actual) {
      errors.push(`Missing generated locale artifact ${artifact.locale}/${artifact.relativePath}; rerun npm run i18n:generate`);
      continue;
    }

    if (formatJson(actual.data) !== formatJson(artifact.data)) {
      errors.push(`${artifact.locale}/${artifact.relativePath} is stale; rerun npm run i18n:generate`);
    }

    actualByKey.delete(key);
  }

  for (const leftover of actualByKey.values()) {
    errors.push(`Unexpected generated locale artifact ${leftover.locale}/${leftover.relativePath}; rerun npm run i18n:generate`);
  }

  return errors;
}

export async function generateI18nResources(options = {}) {
  const { generatedRoot, expectedLocales, artifacts, fileCount } = await loadYamlLocaleTree(options);

  await fs.rm(generatedRoot, { recursive: true, force: true });

  for (const locale of expectedLocales) {
    await fs.mkdir(path.join(generatedRoot, locale), { recursive: true });
  }

  for (const artifact of artifacts) {
    const outputPath = path.join(generatedRoot, artifact.locale, artifact.relativePath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, formatJson(artifact.data), 'utf8');
  }

  return {
    generatedRoot,
    localeCount: expectedLocales.length,
    fileCount,
    artifactCount: artifacts.length,
  };
}

export async function verifyGeneratedI18nResources(options = {}) {
  const { generatedRoot, expectedLocales, artifacts, fileCount } = await loadYamlLocaleTree(options);
  assert(await fileExists(generatedRoot), `Generated locale directory is missing: ${path.relative(repoRoot, generatedRoot)}. Rerun npm run i18n:generate`);
  const generatedTree = await loadGeneratedLocaleTree(options);
  const errors = collectParityErrors(artifacts, generatedTree.artifacts);
  assert.equal(errors.length, 0, errors.join('\n'));

  return {
    generatedRoot,
    localeCount: expectedLocales.length,
    fileCount,
    artifactCount: artifacts.length,
  };
}

function parseCliArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case '--check':
        options.check = true;
        break;
      case '--locales-root':
        options.localesRoot = argv[index + 1];
        index += 1;
        break;
      case '--generated-root':
        options.generatedRoot = argv[index + 1];
        index += 1;
        break;
      case '--config':
        options.configPath = argv[index + 1];
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

async function runCli(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv);
  const summary = options.check
    ? await verifyGeneratedI18nResources(options)
    : await generateI18nResources(options);

  console.log(
    `${options.check ? 'Verified' : 'Generated'} ${summary.artifactCount} locale artifacts across ${summary.localeCount} locales and ${summary.fileCount} source files.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
