# Omnighost — source reconstruction handoff (for Codex)

## 0. Read this first — the mental model that unblocks everything

There are **two independent, hand-maintained representations** of the same plugin
feature set in this project:

1. **`main.js`** — the compiled bundle. It was **edited directly, by hand**, across a
   long session. It was *not* produced by building the `.ts` files in this handoff.
2. **The TypeScript sources** (`main.ts` + `src/**`) — reconstructed *afterward* from
   the repo's baseline `.ts` plus `main.js` as the behavioral reference.

**These two were never in a compile relationship.** Therefore:

- ❌ Do **not** try to regenerate the provided `main.js` from the `.ts` files. A real
  `npm run build` (esbuild) will emit a *behaviorally equivalent but textually
  different* bundle: different identifier names (`import_obsidian10.Notice` vs
  `Notice`), inlined modules, lowered `?.`/`??`, class expressions, ordering. Byte/diff
  equality is impossible and is not the goal.
- ❌ Do **not** treat `main.ts.changes.ts` as a build input or a patch. It is a
  human-readable CHANGE log (CHANGE 1–25), written incrementally against an *early*
  file layout, with prose + illustrative snippets. It is lossy by design. Use it only
  as a narrative index of *why* things changed.
- ✅ **Pick the `.ts` sources as the single source of truth.** Build a **fresh**
  `main.js` from them, test it, ship that. Keep the provided `main.js` only as a
  *behavioral oracle* to cross-check individual methods if a discrepancy shows up.

"Done" = the `.ts` tree **compiles** (`tsc` clean) and **builds** (esbuild) and the
plugin **behaves** like the provided `main.js`. Not "the diff against `main.js` is empty."

## 1. Authority hierarchy (when sources disagree)

1. **`main.js`** — ground truth for *runtime behavior* of every method. If a
   reconstructed `.ts` method seems wrong, extract the same-named function from
   `main.js` and match its *logic* (not its text).
2. **The 7 reconstructed `.ts` files** (below) — ground truth for *source form*.
3. **`main.ts.changes.ts`** — narrative only. Lowest authority; never blocks a decision.

## 2. Why "modals and types differ" — and how to reconcile

This is expected, not a bug. Two reasons:

### Types
TypeScript interfaces are **erased at compile time**. You cannot recover
`GhostBlog` / `GhostWriterSettings` / `GhostPost` shapes from `main.js` — they don't
exist there. Any "type" you infer from the bundle is a guess. The authoritative type
shapes are in the reconstructed **`src/types.ts`**. The only runtime evidence in
`main.js` is the `DEFAULT_SETTINGS` object literal (search `DEFAULT_SETTINGS` /
`promptDeleteOnFolderDelete`) — use it to confirm default *values*, not the interface.

What changed in `types.ts` (vs the repo baseline):
- `GhostBlog` gained optional `syncEnabled?: boolean`, `syncIntervalMinutes?: number`,
  `aliases?: string[]`.
- `GhostWriterSettings` gained `promptDeleteOnFolderDelete`, `confirmEachRemoteDelete`,
  `archiveDeletedNotes`, `archiveFolderName`, with defaults `true, true, true, "Archive"`.

### Modals
`main.js` **inlines every module**, so all modal classes appear flattened as
`var X = class extends import_obsidian10.Modal { … }`. In source they are normal
`class X extends Modal`. A naive text diff will always "differ." More importantly,
note **where** each modal lives in the reconstructed source:

- **Four NEW modal classes are defined at module scope inside `main.ts`** (not in
  `src/modals/`): `DeleteConfirmModal`, `SimpleConfirmModal`, `OrphanPostModal`,
  `BulkDeleteModal`. (They may be extracted into `src/modals/` files later, but then
  you must add the imports; leaving them in `main.ts` is correct and self-contained.)
- **`src/modals/import-from-ghost-modal.ts`** and **`src/modals/link-to-ghost-modal.ts`**
  were modified: each gained an optional 5th constructor arg `plugin` (typed via a small
  local host interface, to avoid a circular import), and the import/link callbacks gained
  a `blog: GhostBlog | null` argument. `main.ts` passes `this` as that 5th arg.
- **`src/modals/edit-properties-modal.ts`, `src/modals/select-blogs-modal.ts`,
  `src/modals/migrate-prefix-modal.ts` were NOT changed.** Keep the repo's versions.

So if Codex compared *its* idea of the modals (e.g. derived from `main.js` or from the
change-notes) against the reconstructed source and saw differences, the reconstructed
source + this map is the intended layout.

## 3. File inventory

### Changed — use the reconstructed files / patches (7 files)
| File | What changed |
|---|---|
| `main.ts` | The bulk of the work: per-blog timers, ghost index + folder-delete batch, all-equal per-blog key model, archive-on-delete, bulk delete, orphaned-post flow, normalize + rename migration, 4 new modal classes, settings-tab additions, blog-aware import/link/seed/schedule. |
| `src/types.ts` | New `GhostBlog` + settings fields (see §2). |
| `src/sync/sync-engine.ts` | Seed writes per-blog keys + sanitized excerpt; `ownsClean` guard on the (now-vestigial) clean-key writeback. |
| `src/frontmatter-parser.ts` | `setFrontmatterKey` now consumes a key's indented block-continuation lines (block-value YAML fix). |
| `src/views/calendar-view.ts` | `buildVaultIndex` indexes **every** `g_id_*` value (+ legacy `g_id`) → note. |
| `src/modals/import-from-ghost-modal.ts` | Blog-aware (5th `plugin` arg; `blog` in callback). |
| `src/modals/link-to-ghost-modal.ts` | Blog-aware (5th `plugin` arg; `blog` in `LinkResult`). |

Each ships as a full file **and** a `*.ts.patch` (unified diff vs the repo baseline,
`git apply` / `patch -p0` ready). `main.ts.patch` is ~1500 lines.

### NOT changed — keep the repo's existing versions (do not overwrite)
`src/ghost/api-client.ts`, `src/templates.ts`, `src/converters/html-to-markdown.ts`,
`src/editor/paywall-decoration.ts`, `src/modals/edit-properties-modal.ts`,
`src/modals/select-blogs-modal.ts`, `src/modals/migrate-prefix-modal.ts`,
`styles.css`, `manifest.json` (bump version only).

> ⚠️ These modules were **never available** during reconstruction — they were not
> uploaded and `main.js` only contains their *compiled* form. The reconstruction
> assumes their **public APIs are unchanged** from the repo baseline (e.g.
> `SyncEngine.setActiveBlog(client, baseUrl, folder, writeBack, knownId?, blogName?)`,
> `GhostAPIClient.{getPost,getPosts,deletePost,testConnection,updateCredentials}`,
> `SelectBlogsModal(app, blogs, selectedIds, {heading, confirmLabel}, onSubmit)`,
> `MigratePrefixModal(app, prefix, onSubmit)`, and the `EditGhostPropertiesModal`
> constructor `main.ts` already calls). If any of these signatures differ in the real
> repo, that's the most likely source of build errors — reconcile against `main.js`.

## 4. Bundle → source translation rules (to verify any method against `main.js`)

To check a reconstructed method's *logic* against the oracle, find the same function
in `main.js` and read it through these substitutions:

- `import_obsidian<NN>.Foo`  → `Foo` (it's a named import from `obsidian`)
- `(0, import_obsidian<NN>.normalizePath)(x)` → `normalizePath(x)`
- bare helpers (`splitFrontmatter`, `upsertFrontmatterKeys`, `removeFrontmatterKeys`,
  `parseGhostMetadata`, `upsertGhostMetadata`, `joinFrontmatter`, `htmlToMarkdown`) →
  same name, imported from `./src/frontmatter-parser` etc.
- esbuild optional-chaining temps `var _a; (_a = x) == null ? void 0 : _a.y` → `x?.y`
- `a != null ? a : b` → `a ?? b`;  `void 0` → `undefined`
- `var X = class extends import_obsidian<NN>.Modal {}` → `class X extends Modal {}`
- types are gone in the bundle — re-add annotations from `src/types.ts` and signatures.

Authoritative method bodies live in `main.js`; search by name, e.g. `syncFileToBlogs`,
`buildBlogStatuses`, `resolveGhostJobs`, `normalizeBlogReferences`, `migrateBlogRename`,
`archiveNote`, `executeBulkDelete`, `openBulkDeleteCommand`, `seedNoteFromGhostBySlug`,
`buildVaultIndex`, `readBlogId`, `blogKeys`.

## 5. Procedure for Codex

1. Start from a clean checkout of the repo (the baseline the `.ts.patch` files diff against).
2. Apply the 7 reconstructed files (drop-in) **or** the 7 `.ts.patch` files
   (`git apply --3way path/to/<file>.ts.patch`). Do not touch the §3 "NOT changed" list.
3. `npm install` (if needed) then **`npm run build`** (or `tsc --noEmit` first).
4. **Fix type/build errors.** The reconstructed `main.ts` was verified here only by a
   TypeScript *syntax* transpile — not a full type-check (the §3 untouched modules and
   `obsidian` types weren't available in that environment). Expected failure modes:
   - signature mismatch with an unchanged module (reconcile against `main.js` logic);
   - `noUnusedLocals`: the now-unused private field `periodicSyncInterval` in `main.ts`
     (delete it) and the unused `SyncEngine.deletePostForFile` (delete it — the live path
     is `resolveGhostJobs` → `deleteOneRemote`);
   - any `EditGhostPropertiesModal` / `SelectBlogsModal` constructor-arg drift.
5. Load the freshly built bundle in Obsidian and **functionally test** the flows
   (import, link, seed, multi-blog sync, orphan prompt, bulk delete, archive-on-delete,
   blog rename → reference migration, calendar). Use the provided `main.js` as the
   behavioral oracle for any ambiguity.
6. Commit the **source** + the **newly built** `main.js`. Discard/ignore the
   hand-edited `main.js` except as reference.

## 6. The all-equal data model (so behavior checks have a spec)

The note is the source of truth; every target blog is an equal destination. There is
**no** shared/"primary" `g_id` / `g_url` / `g_public_url` and no "owner" blog. Each
target blog gets its own keys, suffixed by the blog's domain:

- per-blog: `g_id_<domain>`, `g_url_<domain>` (editor URL), `g_public_url_<domain>`
- shared (note-level): `g_blog`, `g_slug`, `g_published`, `g_published_at`,
  `g_post_access`, `g_featured`, `g_cover_from_first_image`, `g_excerpt`,
  `g_feature_image`, `g_tags`, `g_no_sync`
- matching by `g_blog` token uses domain, current name, or any recorded `alias`
- lingering legacy clean keys are ignored on read and stripped on the next sync

(The `<domain>` suffix is the blog host slugified: `chief.sc` → `chief_sc`.)

## 7. One-line summary to paste back if asked

"`main.js` was hand-edited and `main.ts` was reconstructed from it; they're parallel
copies, not a build pair. Adopt the `.ts` as source, `npm run build` a new `main.js`,
fix type errors against the untouched modules, and verify behavior — don't diff against
the old `main.js`."
