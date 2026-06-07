import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import i18n from '@/locales';
import type { RootState } from '@/store';
import type {
  FileContentResult,
  GitHubRepoDetails,
  ReadmeBatchSubmissionResult,
  ReadmeBatchSubmissionStrategy,
  ReadmeVariant,
  ReadmeWorkspaceResult,
  UpdateRepoPayload,
} from '../../../shared/api';

type LoadStatus = 'idle' | 'loading' | 'succeeded' | 'failed';
type SubmitStatus = 'idle' | 'loading';

const PRIMARY_README_PATH = 'README.md';
const CANONICAL_ENGLISH_README_PATH = 'README_en-us.md';
const LICENSE_FILE_PATH = 'LICENSE';

type RepoDetailsDraftField = 'description' | 'homepage' | 'topics';

interface RepoWorkspaceRequestArgs {
  workspaceKey: string;
  accountId: string;
  owner: string;
  repo: string;
}

interface RepoSaveRequestArgs extends RepoWorkspaceRequestArgs {
  defaultBranch: string;
  strategy: ReadmeBatchSubmissionStrategy;
  branchName?: string;
}

interface RepoWorkspaceThunkError {
  workspaceKey: string;
  message: string;
}

interface RepoDetailsEditorState {
  isEditing: boolean;
  description: string;
  homepage: string;
  topics: string;
  saveStatus: LoadStatus;
  saveMessage: string | null;
}

interface RepoDetailsState {
  data: GitHubRepoDetails | null;
  loadStatus: LoadStatus;
  error: string | null;
  editor: RepoDetailsEditorState;
}

export interface ReadmeWorkspaceVariantState extends ReadmeVariant {
  originalContent: string;
  draft: string;
  dirty: boolean;
  sourceVariantPath?: string;
}

interface RepoReadmeState {
  workspace: ReadmeWorkspaceVariantState[];
  activePath: string;
  isEditing: boolean;
  loadStatus: LoadStatus;
  error: string | null;
  submitStatus: SubmitStatus;
  submitError: string | null;
  saveMessage: string | null;
  browserOpenError: string | null;
}

interface RepoLicenseState {
  content: string;
  draft: string;
  sha: string;
  exists: boolean;
  isEditing: boolean;
  loadStatus: LoadStatus;
  error: string | null;
  submitStatus: SubmitStatus;
  submitError: string | null;
  saveMessage: string | null;
}

interface RepoWorkspaceEntry {
  owner: string;
  repo: string;
  repoFullName: string;
  details: RepoDetailsState;
  readme: RepoReadmeState;
  license: RepoLicenseState;
}

interface RepoWorkspacesState {
  byKey: Record<string, RepoWorkspaceEntry>;
}

interface ReadmeSubmissionSuccessPayload {
  workspaceKey: string;
  workspace: ReadmeWorkspaceVariantState[];
  saveMessage: string;
  browserOpenError: string | null;
}

interface ReadmeSubmissionFailurePayload extends RepoWorkspaceThunkError {
  partialWorkspace?: ReadmeWorkspaceVariantState[];
}

interface LicenseSaveSuccessPayload {
  workspaceKey: string;
  content: string;
  sha: string;
  exists: boolean;
  saveMessage: string;
}

const initialState: RepoWorkspacesState = {
  byKey: {},
};

function buildRepoFullName(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

export function buildRepoWorkspaceKey(accountId: string | null | undefined, owner: string, repo: string): string {
  return `${accountId ?? 'no-account'}:${buildRepoFullName(owner, repo)}`;
}

function createInitialRepoDetailsState(): RepoDetailsState {
  return {
    data: null,
    loadStatus: 'idle',
    error: null,
    editor: {
      isEditing: false,
      description: '',
      homepage: '',
      topics: '',
      saveStatus: 'idle',
      saveMessage: null,
    },
  };
}

function createInitialRepoReadmeState(): RepoReadmeState {
  return {
    workspace: [],
    activePath: PRIMARY_README_PATH,
    isEditing: false,
    loadStatus: 'idle',
    error: null,
    submitStatus: 'idle',
    submitError: null,
    saveMessage: null,
    browserOpenError: null,
  };
}

function createInitialRepoLicenseState(): RepoLicenseState {
  return {
    content: '',
    draft: '',
    sha: '',
    exists: false,
    isEditing: false,
    loadStatus: 'idle',
    error: null,
    submitStatus: 'idle',
    submitError: null,
    saveMessage: null,
  };
}

function createInitialRepoWorkspaceEntry(owner: string, repo: string): RepoWorkspaceEntry {
  return {
    owner,
    repo,
    repoFullName: buildRepoFullName(owner, repo),
    details: createInitialRepoDetailsState(),
    readme: createInitialRepoReadmeState(),
    license: createInitialRepoLicenseState(),
  };
}

function ensureRepoWorkspaceEntry(state: RepoWorkspacesState, workspaceKey: string, owner: string, repo: string): RepoWorkspaceEntry {
  const existing = state.byKey[workspaceKey];

  if (existing) {
    if (owner.length > 0 && repo.length > 0) {
      existing.owner = owner;
      existing.repo = repo;
      existing.repoFullName = buildRepoFullName(owner, repo);
    }

    return existing;
  }

  const created = createInitialRepoWorkspaceEntry(owner, repo);
  state.byKey[workspaceKey] = created;
  return created;
}

function toMessage(error: unknown, fallbackKey: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return i18n.t(fallbackKey, { ns: 'github' });
}

function createRepoDetailsDraft(details: GitHubRepoDetails) {
  return {
    description: details.description ?? '',
    homepage: details.homepage ?? '',
    topics: details.topics.join(', '),
  };
}

function compareReadmeVariantOrder(left: ReadmeVariant, right: ReadmeVariant): number {
  const rank = (path: string, role: ReadmeVariant['role']): number => {
    if (path === PRIMARY_README_PATH || role === 'primary') {
      return 0;
    }

    if (path === CANONICAL_ENGLISH_README_PATH || role === 'canonical-en') {
      return 1;
    }

    return 2;
  };

  const roleComparison = rank(left.path, left.role) - rank(right.path, right.role);
  if (roleComparison !== 0) {
    return roleComparison;
  }

  const localeComparison = left.locale.localeCompare(right.locale);
  return localeComparison !== 0 ? localeComparison : left.path.localeCompare(right.path);
}

function sortReadmeVariants<T extends ReadmeVariant>(variants: T[]): T[] {
  return [...variants].sort(compareReadmeVariantOrder);
}

function createWorkspaceVariants(variants: ReadmeVariant[]): ReadmeWorkspaceVariantState[] {
  return sortReadmeVariants(variants).map((variant) => ({
    ...variant,
    originalContent: variant.content,
    draft: variant.content,
    dirty: false,
  }));
}

function isEnglishVariant(path: string): boolean {
  return path === PRIMARY_README_PATH || path === CANONICAL_ENGLISH_README_PATH;
}

function updateVariantDraft(
  variants: ReadmeWorkspaceVariantState[],
  path: string,
  draft: string,
  sourceVariantPath?: string,
): ReadmeWorkspaceVariantState[] {
  return variants.map((variant) => {
    if (isEnglishVariant(path) && isEnglishVariant(variant.path)) {
      return {
        ...variant,
        draft,
        dirty: draft !== variant.originalContent,
        sourceVariantPath,
      };
    }

    if (variant.path !== path) {
      return variant;
    }

    return {
      ...variant,
      draft,
      dirty: draft !== variant.originalContent,
      sourceVariantPath,
    };
  });
}

function resetWorkspaceDrafts(variants: ReadmeWorkspaceVariantState[]): ReadmeWorkspaceVariantState[] {
  return variants.map((variant) => ({
    ...variant,
    draft: variant.originalContent,
    dirty: false,
    sourceVariantPath: undefined,
  }));
}

function applyReadmeSubmissionResult(
  variants: ReadmeWorkspaceVariantState[],
  result: ReadmeBatchSubmissionResult,
): ReadmeWorkspaceVariantState[] {
  const writtenByPath = new Map(result.files.filter((file) => file.status === 'written').map((file) => [file.path, file]));

  return variants.map((variant) => {
    const written = writtenByPath.get(variant.path);
    if (!written) {
      return variant;
    }

    return {
      ...variant,
      exists: true,
      sha: written.newSha ?? variant.sha,
      content: written.content,
      originalContent: written.content,
      draft: written.content,
      dirty: false,
      sourceVariantPath: undefined,
    };
  });
}

function createLocalizedReadmePath(locale: string): string {
  return `README_${locale}.md`;
}

function buildReadmeCommitMessage(variants: ReadmeWorkspaceVariantState[]): string {
  return variants.some((variant) => variant.exists)
    ? 'Update README variants via Hagihub'
    : 'Create README variants via Hagihub';
}

function buildReadmePullRequestTitle(variants: ReadmeWorkspaceVariantState[]): string {
  return buildReadmeCommitMessage(variants);
}

function resolveReadmeSaveError(
  result: ReadmeBatchSubmissionResult,
  fallback: string,
): string {
  const failedFile = result.failedPath ? result.files.find((file) => file.path === result.failedPath) : undefined;

  let message = fallback;
  if (failedFile?.conflict) {
    message = i18n.t('repoCard.readme.conflictFile', { ns: 'github', filename: failedFile.path });
  } else if (failedFile) {
    message = i18n.t('repoCard.readme.saveFailedFile', {
      ns: 'github',
      filename: failedFile.path,
      error: failedFile.error ?? result.error ?? fallback,
    });
  } else if (result.error) {
    message = result.error;
  }

  const writtenCount = result.files.filter((file) => file.status === 'written').length;
  if (result.strategy === 'direct' && writtenCount > 0) {
    return `${message} ${i18n.t('repoCard.readme.partialSaveHint', { ns: 'github', count: writtenCount })}`;
  }

  return message;
}

function resolveLicenseSaveError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('409')) {
      return i18n.t('repoCard.license.conflict', { ns: 'github' });
    }

    return error.message;
  }

  return i18n.t('repoCard.license.saveFailed', { ns: 'github' });
}

function buildLicenseCommitMessage(action: 'create' | 'update', filename: string): string {
  const verb = action === 'create' ? 'Create' : 'Update';
  return `${verb} ${filename} via Hagihub`;
}

function buildLicensePullRequestTitle(action: 'create' | 'update', filename: string): string {
  const verb = action === 'create' ? 'Create' : 'Update';
  return `${verb} ${filename} via Hagihub`;
}

export const fetchRepoWorkspaceDetails = createAsyncThunk<
  { workspaceKey: string; details: GitHubRepoDetails },
  RepoWorkspaceRequestArgs,
  { rejectValue: RepoWorkspaceThunkError }
>(
  'repoWorkspaces/fetchRepoWorkspaceDetails',
  async ({ workspaceKey, accountId, owner, repo }, { rejectWithValue }) => {
    try {
      const result = await window.hagihub.fetchRepoDetails(accountId, owner, repo);
      return { workspaceKey, details: result.details };
    } catch (error) {
      return rejectWithValue({
        workspaceKey,
        message: toMessage(error, 'repoCard.info.saveFailed'),
      });
    }
  },
);

export const saveRepoWorkspaceDetails = createAsyncThunk<
  { workspaceKey: string; details: GitHubRepoDetails },
  RepoWorkspaceRequestArgs,
  { state: RootState; rejectValue: RepoWorkspaceThunkError }
>(
  'repoWorkspaces/saveRepoWorkspaceDetails',
  async ({ workspaceKey, accountId, owner, repo }, { getState, rejectWithValue }) => {
    const workspace = getState().repoWorkspaces.byKey[workspaceKey];
    const details = workspace?.details.data;
    const editor = workspace?.details.editor;

    if (!details || !editor) {
      return rejectWithValue({
        workspaceKey,
        message: i18n.t('repoCard.info.saveFailed', { ns: 'github' }),
      });
    }

    const updates: UpdateRepoPayload = {};
    const trimmedDescription = editor.description.trim();
    const trimmedHomepage = editor.homepage.trim();
    const parsedTopics = editor.topics.split(',').map((topic) => topic.trim()).filter(Boolean);
    const topicsChanged = JSON.stringify(parsedTopics) !== JSON.stringify(details.topics);

    if (trimmedDescription !== (details.description ?? '')) {
      updates.description = trimmedDescription;
    }

    if (trimmedHomepage !== (details.homepage ?? '')) {
      updates.homepage = trimmedHomepage;
    }

    try {
      let nextDetails = details;

      if (Object.keys(updates).length > 0) {
        const result = await window.hagihub.updateRepo(accountId, owner, repo, updates);
        nextDetails = result.details;
      }

      if (topicsChanged) {
        const topicsResult = await window.hagihub.updateRepoTopics(accountId, owner, repo, parsedTopics);
        nextDetails = { ...nextDetails, topics: topicsResult.names };
      }

      return {
        workspaceKey,
        details: nextDetails,
      };
    } catch (error) {
      return rejectWithValue({
        workspaceKey,
        message: toMessage(error, 'repoCard.info.saveFailed'),
      });
    }
  },
);

export const fetchRepoReadmeWorkspace = createAsyncThunk<
  { workspaceKey: string; result: ReadmeWorkspaceResult },
  RepoWorkspaceRequestArgs,
  { rejectValue: RepoWorkspaceThunkError }
>(
  'repoWorkspaces/fetchRepoReadmeWorkspace',
  async ({ workspaceKey, accountId, owner, repo }, { rejectWithValue }) => {
    try {
      const result = await window.hagihub.fetchReadmeWorkspace(accountId, owner, repo);
      return { workspaceKey, result };
    } catch (error) {
      return rejectWithValue({
        workspaceKey,
        message: toMessage(error, 'repoCard.readme.loadFailed'),
      });
    }
  },
);

export const submitRepoReadmeWorkspace = createAsyncThunk<
  ReadmeSubmissionSuccessPayload,
  RepoSaveRequestArgs,
  { state: RootState; rejectValue: ReadmeSubmissionFailurePayload }
>(
  'repoWorkspaces/submitRepoReadmeWorkspace',
  async ({ workspaceKey, accountId, owner, repo, defaultBranch, strategy, branchName }, { getState, rejectWithValue }) => {
    const workspace = getState().repoWorkspaces.byKey[workspaceKey]?.readme.workspace ?? [];

    if (workspace.length === 0) {
      return rejectWithValue({
        workspaceKey,
        message: i18n.t('repoCard.readme.saveFailed', { ns: 'github' }),
      });
    }

    try {
      const result = await window.hagihub.submitReadmeWorkspace(accountId, owner, repo, {
        defaultBranch,
        strategy,
        branchName: branchName?.trim(),
        commitMessage: buildReadmeCommitMessage(workspace),
        pullRequestTitle: buildReadmePullRequestTitle(workspace),
        variants: workspace.map((variant) => ({
          path: variant.path,
          locale: variant.locale,
          role: variant.role,
          exists: variant.exists,
          sha: variant.sha,
          content: variant.draft,
          originalContent: variant.originalContent,
        })),
      });

      const writtenCount = result.files.filter((file) => file.status === 'written').length;

      if (!result.success) {
        return rejectWithValue({
          workspaceKey,
          message: resolveReadmeSaveError(result, i18n.t('repoCard.readme.saveFailed', { ns: 'github' })),
          partialWorkspace: result.strategy === 'direct' && writtenCount > 0
            ? applyReadmeSubmissionResult(workspace, result)
            : undefined,
        });
      }

      if (result.strategy === 'pull_request' && result.pullRequest) {
        const refreshed = await window.hagihub.fetchReadmeWorkspace(accountId, owner, repo);
        const openResult = await window.hagihub.openExternal(result.pullRequest.htmlUrl);

        return {
          workspaceKey,
          workspace: createWorkspaceVariants(refreshed.variants),
          saveMessage: i18n.t('repoCard.readme.prSuccessSummary', {
            ns: 'github',
            number: result.pullRequest.number,
            count: writtenCount,
          }),
          browserOpenError: openResult.success
            ? null
            : openResult.error ?? i18n.t('errors.openPullRequestFailed', { ns: 'github' }),
        };
      }

      return {
        workspaceKey,
        workspace: applyReadmeSubmissionResult(workspace, result),
        saveMessage: i18n.t('repoCard.readme.saveSuccessSummary', { ns: 'github', count: writtenCount }),
        browserOpenError: null,
      };
    } catch (error) {
      return rejectWithValue({
        workspaceKey,
        message: toMessage(error, 'repoCard.readme.saveFailed'),
      });
    }
  },
);

export const fetchRepoLicense = createAsyncThunk<
  { workspaceKey: string; result: FileContentResult },
  RepoWorkspaceRequestArgs,
  { rejectValue: RepoWorkspaceThunkError }
>(
  'repoWorkspaces/fetchRepoLicense',
  async ({ workspaceKey, accountId, owner, repo }, { rejectWithValue }) => {
    try {
      const result = await window.hagihub.fetchFileContent(accountId, owner, repo, LICENSE_FILE_PATH);
      return { workspaceKey, result };
    } catch (error) {
      return rejectWithValue({
        workspaceKey,
        message: toMessage(error, 'repoCard.license.loadFailed'),
      });
    }
  },
);

export const submitRepoLicense = createAsyncThunk<
  LicenseSaveSuccessPayload,
  RepoSaveRequestArgs,
  { state: RootState; rejectValue: RepoWorkspaceThunkError }
>(
  'repoWorkspaces/submitRepoLicense',
  async ({ workspaceKey, accountId, owner, repo, defaultBranch, strategy, branchName }, { getState, rejectWithValue }) => {
    const licenseState = getState().repoWorkspaces.byKey[workspaceKey]?.license;

    if (!licenseState) {
      return rejectWithValue({
        workspaceKey,
        message: i18n.t('repoCard.license.saveFailed', { ns: 'github' }),
      });
    }

    const action = licenseState.exists ? 'update' : 'create';

    try {
      if (strategy === 'pull_request') {
        const nextBranchName = branchName?.trim() ?? '';

        await window.hagihub.createRef(accountId, owner, repo, {
          ref: nextBranchName,
          sha: defaultBranch,
        });

        const commitResult = await window.hagihub.commitFile(accountId, owner, repo, LICENSE_FILE_PATH, {
          content: licenseState.draft,
          message: buildLicenseCommitMessage(action, LICENSE_FILE_PATH),
          branch: nextBranchName,
          sha: licenseState.sha,
        });

        const pullRequest = await window.hagihub.createPullRequest(accountId, owner, repo, {
          title: buildLicensePullRequestTitle(action, LICENSE_FILE_PATH),
          head: nextBranchName,
          base: defaultBranch,
        });

        return {
          workspaceKey,
          content: licenseState.draft,
          sha: commitResult.newSha,
          exists: true,
          saveMessage: i18n.t('repoCard.license.prSuccess', { ns: 'github', number: pullRequest.number }),
        };
      }

      const commitResult = await window.hagihub.commitFile(accountId, owner, repo, LICENSE_FILE_PATH, {
        content: licenseState.draft,
        message: buildLicenseCommitMessage(action, LICENSE_FILE_PATH),
        branch: defaultBranch,
        sha: licenseState.sha,
      });

      return {
        workspaceKey,
        content: licenseState.draft,
        sha: commitResult.newSha,
        exists: true,
        saveMessage: i18n.t('repoCard.license.saveSuccess', { ns: 'github' }),
      };
    } catch (error) {
      return rejectWithValue({
        workspaceKey,
        message: resolveLicenseSaveError(error),
      });
    }
  },
);

const repoWorkspaceSlice = createSlice({
  name: 'repoWorkspaces',
  initialState,
  reducers: {
    beginRepoDetailsEditing(state, action: PayloadAction<{ workspaceKey: string; owner: string; repo: string }>) {
      const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.payload.owner, action.payload.repo);

      if (!workspace.details.data) {
        return;
      }

      const draft = createRepoDetailsDraft(workspace.details.data);
      workspace.details.editor.isEditing = true;
      workspace.details.editor.description = draft.description;
      workspace.details.editor.homepage = draft.homepage;
      workspace.details.editor.topics = draft.topics;
      workspace.details.editor.saveStatus = 'idle';
      workspace.details.editor.saveMessage = null;
    },
    cancelRepoDetailsEditing(state, action: PayloadAction<{ workspaceKey: string; owner: string; repo: string }>) {
      const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.payload.owner, action.payload.repo);

      if (workspace.details.data) {
        const draft = createRepoDetailsDraft(workspace.details.data);
        workspace.details.editor.description = draft.description;
        workspace.details.editor.homepage = draft.homepage;
        workspace.details.editor.topics = draft.topics;
      }

      workspace.details.editor.isEditing = false;
      workspace.details.editor.saveStatus = 'idle';
      workspace.details.editor.saveMessage = null;
    },
    setRepoDetailsDraftField(state, action: PayloadAction<{
      workspaceKey: string;
      owner: string;
      repo: string;
      field: RepoDetailsDraftField;
      value: string;
    }>) {
      const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.payload.owner, action.payload.repo);
      workspace.details.editor[action.payload.field] = action.payload.value;
      workspace.details.editor.saveMessage = null;
    },
    beginReadmeEditing(state, action: PayloadAction<{ workspaceKey: string; owner: string; repo: string }>) {
      const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.payload.owner, action.payload.repo);
      workspace.readme.isEditing = true;
      workspace.readme.submitError = null;
      workspace.readme.saveMessage = null;
      workspace.readme.browserOpenError = null;
    },
    cancelReadmeEditing(state, action: PayloadAction<{ workspaceKey: string; owner: string; repo: string }>) {
      const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.payload.owner, action.payload.repo);
      workspace.readme.workspace = resetWorkspaceDrafts(workspace.readme.workspace);
      workspace.readme.isEditing = false;
      workspace.readme.submitError = null;
      workspace.readme.saveMessage = null;
      workspace.readme.browserOpenError = null;
    },
    setActiveReadmePath(state, action: PayloadAction<{ workspaceKey: string; owner: string; repo: string; path: string }>) {
      const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.payload.owner, action.payload.repo);
      workspace.readme.activePath = action.payload.path;
    },
    updateReadmeDraft(state, action: PayloadAction<{
      workspaceKey: string;
      owner: string;
      repo: string;
      path: string;
      draft: string;
      sourceVariantPath?: string;
    }>) {
      const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.payload.owner, action.payload.repo);
      workspace.readme.workspace = updateVariantDraft(
        workspace.readme.workspace,
        action.payload.path,
        action.payload.draft,
        action.payload.sourceVariantPath,
      );
      workspace.readme.isEditing = true;
      workspace.readme.saveMessage = null;
      workspace.readme.browserOpenError = null;
    },
    addReadmeLanguage(state, action: PayloadAction<{ workspaceKey: string; owner: string; repo: string; locale: string }>) {
      const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.payload.owner, action.payload.repo);
      const path = createLocalizedReadmePath(action.payload.locale);

      if (workspace.readme.workspace.some((variant) => variant.path === path)) {
        workspace.readme.activePath = path;
        return;
      }

      const nextVariant: ReadmeWorkspaceVariantState = {
        path,
        locale: action.payload.locale,
        role: 'localized',
        exists: false,
        content: '',
        originalContent: '',
        draft: '',
        sha: '',
        dirty: true,
      };

      workspace.readme.workspace = sortReadmeVariants([...workspace.readme.workspace, nextVariant]);
      workspace.readme.activePath = path;
      workspace.readme.isEditing = true;
      workspace.readme.saveMessage = null;
      workspace.readme.browserOpenError = null;
    },
    copyReadmeVariantDraft(state, action: PayloadAction<{
      workspaceKey: string;
      owner: string;
      repo: string;
      targetPath: string;
      sourcePath: string;
    }>) {
      const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.payload.owner, action.payload.repo);
      const sourceVariant = workspace.readme.workspace.find((variant) => variant.path === action.payload.sourcePath);

      if (!sourceVariant) {
        return;
      }

      workspace.readme.workspace = updateVariantDraft(
        workspace.readme.workspace,
        action.payload.targetPath,
        sourceVariant.draft,
        sourceVariant.path,
      );
      workspace.readme.isEditing = true;
      workspace.readme.saveMessage = null;
      workspace.readme.browserOpenError = null;
    },
    clearReadmeSubmitError(state, action: PayloadAction<{ workspaceKey: string; owner: string; repo: string }>) {
      const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.payload.owner, action.payload.repo);
      workspace.readme.submitError = null;
    },
    beginLicenseEditing(state, action: PayloadAction<{ workspaceKey: string; owner: string; repo: string }>) {
      const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.payload.owner, action.payload.repo);
      workspace.license.draft = workspace.license.content;
      workspace.license.isEditing = true;
      workspace.license.submitError = null;
      workspace.license.saveMessage = null;
    },
    cancelLicenseEditing(state, action: PayloadAction<{ workspaceKey: string; owner: string; repo: string }>) {
      const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.payload.owner, action.payload.repo);
      workspace.license.draft = workspace.license.content;
      workspace.license.isEditing = false;
      workspace.license.submitError = null;
      workspace.license.saveMessage = null;
    },
    setLicenseDraft(state, action: PayloadAction<{ workspaceKey: string; owner: string; repo: string; draft: string }>) {
      const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.payload.owner, action.payload.repo);
      workspace.license.draft = action.payload.draft;
      workspace.license.isEditing = true;
      workspace.license.saveMessage = null;
    },
    clearLicenseSubmitError(state, action: PayloadAction<{ workspaceKey: string; owner: string; repo: string }>) {
      const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.payload.owner, action.payload.repo);
      workspace.license.submitError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRepoWorkspaceDetails.pending, (state, action) => {
        const workspace = ensureRepoWorkspaceEntry(state, action.meta.arg.workspaceKey, action.meta.arg.owner, action.meta.arg.repo);
        workspace.details.loadStatus = 'loading';
        workspace.details.error = null;
      })
      .addCase(fetchRepoWorkspaceDetails.fulfilled, (state, action) => {
        const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.payload.details.fullName.split('/')[0] ?? '', action.payload.details.name);
        const draft = createRepoDetailsDraft(action.payload.details);
        workspace.details.data = action.payload.details;
        workspace.details.loadStatus = 'succeeded';
        workspace.details.error = null;
        workspace.details.editor.isEditing = false;
        workspace.details.editor.description = draft.description;
        workspace.details.editor.homepage = draft.homepage;
        workspace.details.editor.topics = draft.topics;
        workspace.details.editor.saveStatus = 'idle';
      })
      .addCase(fetchRepoWorkspaceDetails.rejected, (state, action) => {
        const payload = action.payload;
        if (!payload) {
          return;
        }

        const workspace = ensureRepoWorkspaceEntry(state, payload.workspaceKey, '', '');
        workspace.details.loadStatus = 'failed';
        workspace.details.error = payload.message;
      })
      .addCase(saveRepoWorkspaceDetails.pending, (state, action) => {
        const workspace = ensureRepoWorkspaceEntry(state, action.meta.arg.workspaceKey, action.meta.arg.owner, action.meta.arg.repo);
        workspace.details.editor.saveStatus = 'loading';
        workspace.details.editor.saveMessage = null;
      })
      .addCase(saveRepoWorkspaceDetails.fulfilled, (state, action) => {
        const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.payload.details.fullName.split('/')[0] ?? '', action.payload.details.name);
        const draft = createRepoDetailsDraft(action.payload.details);
        workspace.details.data = action.payload.details;
        workspace.details.loadStatus = 'succeeded';
        workspace.details.error = null;
        workspace.details.editor.isEditing = false;
        workspace.details.editor.description = draft.description;
        workspace.details.editor.homepage = draft.homepage;
        workspace.details.editor.topics = draft.topics;
        workspace.details.editor.saveStatus = 'succeeded';
        workspace.details.editor.saveMessage = i18n.t('repoCard.info.saveSuccess', { ns: 'github' });
      })
      .addCase(saveRepoWorkspaceDetails.rejected, (state, action) => {
        const payload = action.payload;
        if (!payload) {
          return;
        }

        const workspace = ensureRepoWorkspaceEntry(state, payload.workspaceKey, '', '');
        workspace.details.editor.saveStatus = 'failed';
        workspace.details.editor.saveMessage = payload.message;
      })
      .addCase(fetchRepoReadmeWorkspace.pending, (state, action) => {
        const workspace = ensureRepoWorkspaceEntry(state, action.meta.arg.workspaceKey, action.meta.arg.owner, action.meta.arg.repo);
        workspace.readme.loadStatus = 'loading';
        workspace.readme.error = null;
      })
      .addCase(fetchRepoReadmeWorkspace.fulfilled, (state, action) => {
        const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.meta.arg.owner, action.meta.arg.repo);
        const nextWorkspace = createWorkspaceVariants(action.payload.result.variants);
        workspace.readme.workspace = nextWorkspace;
        workspace.readme.activePath = nextWorkspace.some((variant) => variant.path === workspace.readme.activePath)
          ? workspace.readme.activePath
          : PRIMARY_README_PATH;
        workspace.readme.isEditing = false;
        workspace.readme.loadStatus = 'succeeded';
        workspace.readme.error = null;
        workspace.readme.submitStatus = 'idle';
        workspace.readme.submitError = null;
      })
      .addCase(fetchRepoReadmeWorkspace.rejected, (state, action) => {
        const payload = action.payload;
        if (!payload) {
          return;
        }

        const workspace = ensureRepoWorkspaceEntry(state, payload.workspaceKey, '', '');
        workspace.readme.loadStatus = 'failed';
        workspace.readme.error = payload.message;
      })
      .addCase(submitRepoReadmeWorkspace.pending, (state, action) => {
        const workspace = ensureRepoWorkspaceEntry(state, action.meta.arg.workspaceKey, action.meta.arg.owner, action.meta.arg.repo);
        workspace.readme.submitStatus = 'loading';
        workspace.readme.submitError = null;
        workspace.readme.saveMessage = null;
        workspace.readme.browserOpenError = null;
      })
      .addCase(submitRepoReadmeWorkspace.fulfilled, (state, action) => {
        const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, '', '');
        workspace.readme.workspace = action.payload.workspace;
        workspace.readme.activePath = action.payload.workspace.some((variant) => variant.path === workspace.readme.activePath)
          ? workspace.readme.activePath
          : PRIMARY_README_PATH;
        workspace.readme.isEditing = false;
        workspace.readme.submitStatus = 'idle';
        workspace.readme.submitError = null;
        workspace.readme.saveMessage = action.payload.saveMessage;
        workspace.readme.browserOpenError = action.payload.browserOpenError;
      })
      .addCase(submitRepoReadmeWorkspace.rejected, (state, action) => {
        const payload = action.payload;
        if (!payload) {
          return;
        }

        const workspace = ensureRepoWorkspaceEntry(state, payload.workspaceKey, '', '');
        if (payload.partialWorkspace) {
          workspace.readme.workspace = payload.partialWorkspace;
        }

        workspace.readme.submitStatus = 'idle';
        workspace.readme.submitError = payload.message;
      })
      .addCase(fetchRepoLicense.pending, (state, action) => {
        const workspace = ensureRepoWorkspaceEntry(state, action.meta.arg.workspaceKey, action.meta.arg.owner, action.meta.arg.repo);
        workspace.license.loadStatus = 'loading';
        workspace.license.error = null;
      })
      .addCase(fetchRepoLicense.fulfilled, (state, action) => {
        const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, action.meta.arg.owner, action.meta.arg.repo);
        workspace.license.content = action.payload.result.content;
        workspace.license.draft = action.payload.result.content;
        workspace.license.sha = action.payload.result.sha;
        workspace.license.exists = action.payload.result.exists;
        workspace.license.isEditing = false;
        workspace.license.loadStatus = 'succeeded';
        workspace.license.error = null;
        workspace.license.submitStatus = 'idle';
        workspace.license.submitError = null;
      })
      .addCase(fetchRepoLicense.rejected, (state, action) => {
        const payload = action.payload;
        if (!payload) {
          return;
        }

        const workspace = ensureRepoWorkspaceEntry(state, payload.workspaceKey, '', '');
        workspace.license.loadStatus = 'failed';
        workspace.license.error = payload.message;
      })
      .addCase(submitRepoLicense.pending, (state, action) => {
        const workspace = ensureRepoWorkspaceEntry(state, action.meta.arg.workspaceKey, action.meta.arg.owner, action.meta.arg.repo);
        workspace.license.submitStatus = 'loading';
        workspace.license.submitError = null;
        workspace.license.saveMessage = null;
      })
      .addCase(submitRepoLicense.fulfilled, (state, action) => {
        const workspace = ensureRepoWorkspaceEntry(state, action.payload.workspaceKey, '', '');
        workspace.license.content = action.payload.content;
        workspace.license.draft = action.payload.content;
        workspace.license.sha = action.payload.sha;
        workspace.license.exists = action.payload.exists;
        workspace.license.isEditing = false;
        workspace.license.submitStatus = 'idle';
        workspace.license.submitError = null;
        workspace.license.saveMessage = action.payload.saveMessage;
      })
      .addCase(submitRepoLicense.rejected, (state, action) => {
        const payload = action.payload;
        if (!payload) {
          return;
        }

        const workspace = ensureRepoWorkspaceEntry(state, payload.workspaceKey, '', '');
        workspace.license.submitStatus = 'idle';
        workspace.license.submitError = payload.message;
      });
  },
});

export const {
  addReadmeLanguage,
  beginLicenseEditing,
  beginReadmeEditing,
  beginRepoDetailsEditing,
  cancelLicenseEditing,
  cancelReadmeEditing,
  cancelRepoDetailsEditing,
  clearLicenseSubmitError,
  clearReadmeSubmitError,
  copyReadmeVariantDraft,
  setActiveReadmePath,
  setLicenseDraft,
  setRepoDetailsDraftField,
  updateReadmeDraft,
} = repoWorkspaceSlice.actions;

export default repoWorkspaceSlice.reducer;
