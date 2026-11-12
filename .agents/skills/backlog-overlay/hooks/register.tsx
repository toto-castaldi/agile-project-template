/**
 * Backlog pane: read-only browser for the items of backlog/, for Claude Code.
 *
 * `/backlog` opens it beside the conversation (it also works while a turn
 * runs) and asks for the keyboard; when the surface does not grant it, the pane
 * says so: ctrl+x tab gives it the keys.
 * One item per screen:
 *   n / b     next / previous item (by version, epic and ID)
 *   g / e     first / last item
 *   t p s     next Type / Priority / Status filter
 *   x         reset the filters
 *   r         read the backlog and the item branches again
 *   arrows    scroll the current item
 *   Esc or q  close
 *
 * Navigation visits only the items that match all three filters. The filters
 * start as `Type: all · Priority: all · Status: Todo` and are kept for the rest
 * of the Claude Code session.
 *
 * Item branches: states are resolved by the backlog CLI
 * (`export --json --branches`, rules in docs/PROCESS-PARALLEL.md §1), exactly as
 * in the pi overlay (.pi/extensions/backlog/). The pane shows the current
 * directory at once, then the states from the local refs and, when the
 * repository has a remote, the states after `git fetch --prune`.
 *
 * Project-agnostic: it relies only on the JSON output of the backlog CLI and
 * never writes any file; only the fetch updates git refs.
 */
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { BacklogData, BacklogField, BacklogFilters, BacklogItem } from '../types'

const PANE = 'backlog'
const BACKLOG_TOOL = '.agents/tools/backlog.py'
const READ_TIMEOUT_MS = 10_000
/** Branch resolution with a fetch waits for git too (10 s fetch timeout in the CLI). */
const BRANCHES_TIMEOUT_MS = 30_000

const ALL = 'all'
const FILTERS = [
  { key: 't', field: 'Type', values: [ALL, 'User Story', 'Task', 'Spike', 'Bug'] },
  { key: 'p', field: 'Priority', values: [ALL, 'P0', 'P1', 'P2'] },
  { key: 's', field: 'Status', values: [ALL, 'Todo', 'In Progress', 'Blocked', 'Done', 'Dropped'] },
] as const
const DEFAULT_FILTERS: BacklogFilters = { Type: ALL, Priority: ALL, Status: 'Todo' }

// Change a tag when the shape of its value changes: it declines what an
// earlier version stored, which outlives a reload.
const filtersAtom = atom({ plugin: 'backlog-overlay', key: 'filters' } as const, DEFAULT_FILTERS, {
  shape: 'filters-1',
})
const currentAtom = atom({ plugin: 'backlog-overlay', key: 'current' } as const, '', { shape: 'current-1' })
const dataAtom = atom({ plugin: 'backlog-overlay', key: 'data' } as const, { kind: 'loading' } as BacklogData, {
  shape: 'data-1',
})

// ---------------------------------------------------------------------------
// Reading the store through the CLI
// ---------------------------------------------------------------------------

type BacklogRecord = Record<string, unknown>

/** Output of `backlog export --json [--branches]`. */
type ExportedStore = {
  versions: BacklogRecord[]
  epics: BacklogRecord[]
  items: BacklogRecord[]
  branches?: {
    fetch: 'done' | 'failed' | 'skipped' | 'none'
    remotes: string[]
    items: Record<string, { source: string; also_in: string[] }>
  }
}

const ITEM_LABELS: ReadonlyArray<readonly [string, string]> = [
  ['Epic', 'epic'],
  ['Module', 'module'],
  ['Type', 'type'],
  ['Priority', 'priority'],
  ['Status', 'status'],
  ['Branch', 'branch'],
  ['Dependencies', 'dependencies'],
  ['Dependency override', 'dependency_override'],
  ['Requirements', 'requirements'],
  ['Design references', 'design_references'],
  ['Description', 'description'],
  ['Found in', 'found_in'],
  ['Steps to reproduce', 'steps_to_reproduce'],
  ['Expected', 'expected'],
  ['Actual', 'actual'],
]

const text = (value: unknown) => (value === undefined || value === null ? '' : String(value))
const strings = (value: unknown) => (Array.isArray(value) ? value.map(String) : [])

function toItem(record: BacklogRecord, store: ExportedStore): BacklogItem {
  const fields: BacklogField[] = []
  for (const [label, field] of ITEM_LABELS) {
    const value = record[field]
    const shown = Array.isArray(value) ? value.join(', ') : text(value)
    if (shown) fields.push({ label, value: shown })
    else if (field === 'dependencies') fields.push({ label, value: 'none' })
  }
  fields.push({ label: 'Acceptance criteria', list: strings(record.acceptance_criteria) })
  if (strings(record.remarks).length > 0) fields.push({ label: 'Remarks', list: strings(record.remarks) })
  if (record.blocked_by) fields.push({ label: 'Blocked by', value: text(record.blocked_by) })
  if (record.outcome) fields.push({ label: 'Outcome', value: `${text(record.outcome)} (${text(record.closed_at)})` })

  const id = text(record.id)
  const versionId = text(record.version)
  const epicId = text(record.epic)
  const version = store.versions.find((v) => text(v.id) === versionId)
  const epic = store.epics.find((e) => text(e.id) === epicId)
  const origin = store.branches?.items[id]
  return {
    id,
    title: text(record.title),
    version: versionId ? `Version ${versionId}` : undefined,
    versionState: version ? text(version.state) || undefined : undefined,
    epic: epicId ? `${epicId}${epic ? ` — ${text(epic.title)}` : ''}` : undefined,
    type: text(record.type),
    priority: text(record.priority),
    status: text(record.status),
    fields,
    source: origin?.source,
    alsoIn: origin && origin.also_in.length > 0 ? origin.also_in : undefined,
  }
}

/** Items in display order: by version, then epic; the CLI already orders by ID. */
function toItems(store: ExportedStore): BacklogItem[] {
  const order = (a: string | undefined, b: string | undefined) =>
    (a ?? '￿').localeCompare(b ?? '￿', undefined, { numeric: true })
  return store.items
    .map((record) => toItem(record, store))
    .sort((a, b) => order(a.version, b.version) || order(a.epic, b.epic))
}

type Exported = { store: ExportedStore } | { message: string }

async function exportStore($: EngineInterface, extra: string[], timeoutMs: number): Promise<Exported> {
  try {
    const run = await $.process.run(['python3', BACKLOG_TOOL, 'export', '--json', ...extra], {
      timeoutMs,
      env: { GIT_TERMINAL_PROMPT: '0' },
    })
    if (run.exitCode !== 0) {
      const detail = run.stderr.trim() || `exit code ${run.exitCode}`
      return { message: `Cannot read the backlog with ${BACKLOG_TOOL}: ${detail}` }
    }
    return { store: JSON.parse(run.stdout) as ExportedStore }
  } catch (error) {
    return { message: `Cannot run python3 ${BACKLOG_TOOL}: ${error instanceof Error ? error.message : String(error)}` }
  }
}

/** Each refresh supersedes the previous one: only the latest writes. */
let generation = 0

/**
 * The current directory first, then the states from the local item branches,
 * then, when the repository has a remote, again after the fetch.
 */
async function refresh($: EngineInterface): Promise<void> {
  const mine = ++generation
  const stale = () => mine !== generation
  const set = (value: BacklogData) => update($, dataAtom, () => value)

  const base = await exportStore($, [], READ_TIMEOUT_MS)
  if (stale()) return
  if ('message' in base) return void (await set({ kind: 'message', message: base.message }))
  if (base.store.items.length === 0) return void (await set({ kind: 'message', message: 'The backlog contains no items.' }))
  await set({ kind: 'items', items: toItems(base.store), fetch: 'none' })

  const local = await exportStore($, ['--branches', '--no-fetch'], BRANCHES_TIMEOUT_MS)
  if (stale() || 'message' in local || !local.store.branches || local.store.branches.fetch === 'none') return
  const hasRemote = local.store.branches.remotes.length > 0
  await set({ kind: 'items', items: toItems(local.store), fetch: hasRemote ? 'fetching' : 'none' })
  if (!hasRemote) return

  const fetched = await exportStore($, ['--branches'], BRANCHES_TIMEOUT_MS)
  if (stale()) return
  if ('message' in fetched || fetched.store.branches?.fetch !== 'done') {
    await set({ kind: 'items', items: toItems(local.store), fetch: 'failed' })
    return
  }
  await set({ kind: 'items', items: toItems(fetched.store), fetch: 'done' })
}

// ---------------------------------------------------------------------------
// Filters and navigation
// ---------------------------------------------------------------------------

function matches(item: BacklogItem, filters: BacklogFilters): boolean {
  const value = { Type: item.type, Priority: item.priority, Status: item.status }
  return FILTERS.every(({ field }) => {
    const selected = filters[field]
    return selected === ALL || value[field].toLowerCase().startsWith(selected.toLowerCase())
  })
}

/** The matching items and the position of the one shown: the current one, else the first. */
function position(data: BacklogData, filters: BacklogFilters, current: string) {
  const matching = data.kind === 'items' ? data.items.filter((item) => matches(item, filters)) : []
  const index = Math.max(0, matching.findIndex((item) => item.id === current))
  return { matching, index }
}

type Move = 'next' | 'previous' | 'first' | 'last'

async function move($: EngineInterface, where: Move): Promise<void> {
  const data = await read($, dataAtom)
  const filters = await read($, filtersAtom)
  const current = await read($, currentAtom)
  const { matching, index } = position(data, filters, current)
  if (matching.length === 0) return
  const target = {
    next: Math.min(matching.length - 1, index + 1),
    previous: Math.max(0, index - 1),
    first: 0,
    last: matching.length - 1,
  }[where]
  await update($, currentAtom, () => matching[target]!.id)
}

async function cycleFilter($: EngineInterface, field: keyof BacklogFilters): Promise<void> {
  const values: readonly string[] = FILTERS.find((f) => f.field === field)!.values
  await update($, filtersAtom, (filters) => {
    const at = Math.max(0, values.indexOf(filters[field]))
    return { ...filters, [field]: values[(at + 1) % values.length]! }
  })
}

const OPEN = { id: PANE, title: 'Backlog', focus: true, closeOnEscape: true, rows: 24 } as const
const FOCUS_HINT = 'ctrl+x tab gives the keys to the backlog pane'

const isFocused = async ($: EngineInterface) => (await $.ui.panes()).some((p) => p.id === PANE && p.isFocused)

/**
 * The surface grants `focus` only while the prompt holds the keys over an empty
 * composer, which may not yet be so while `/backlog` runs: ask once more right
 * after, then tell the person how to give the keys.
 */
async function claimKeyboard($: EngineInterface): Promise<void> {
  if (await isFocused($)) return
  await $.clock.sleep(150)
  await $.ui.open(OPEN)
  await $.clock.sleep(150)
  if (!(await isFocused($))) $.ui.toast(FOCUS_HINT)
}

async function openPane($: EngineInterface): Promise<void> {
  await $.ui.open(OPEN)
  // In the background: the pane shows `Reading the backlog…` meanwhile. A failure
  // (the module reloaded, the session ended) leaves the pane as it is.
  void refresh($).catch(() => undefined)
  void claimKeyboard($).catch(() => undefined)
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function statusColor(status: string) {
  if (/^done\b/i.test(status)) return 'success'
  if (/^blocked\b/i.test(status)) return 'error'
  if (/^in progress\b/i.test(status)) return 'suggestion'
  return 'inactive'
}

function priorityColor(priority: string) {
  if (/^P0\b/.test(priority)) return 'error'
  if (/^P1\b/.test(priority)) return 'warning'
  return 'inactive'
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'backlog',
      description: 'Browse backlog items (read-only pane)',
      immediate: true,
    })
    return next(e)
  })

  on('command.run', { command: 'backlog' }, async ($) => {
    await openPane($)
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const data = await read($, dataAtom)
    const filters = await read($, filtersAtom)
    const current = await read($, currentAtom)

    const hint = !e.props.isFocused && <Text color="warning">{FOCUS_HINT}</Text>
    const controls = (
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Button key="previous" hotkey="b" plain onPress={() => move($, 'previous')}>previous</Button>
        <Button key="next" hotkey="n" plain onPress={() => move($, 'next')}>next</Button>
        <Button key="first" hotkey="g" plain onPress={() => move($, 'first')}>first</Button>
        <Button key="last" hotkey="e" plain onPress={() => move($, 'last')}>last</Button>
        <Button key="type" hotkey="t" plain onPress={() => cycleFilter($, 'Type')}>type</Button>
        <Button key="priority" hotkey="p" plain onPress={() => cycleFilter($, 'Priority')}>priority</Button>
        <Button key="status" hotkey="s" plain onPress={() => cycleFilter($, 'Status')}>status</Button>
        <Button key="reset" hotkey="x" plain onPress={() => update($, filtersAtom, () => DEFAULT_FILTERS)}>reset filters</Button>
        <Button key="reload" hotkey="r" plain onPress={() => refresh($)}>reload</Button>
        <Button key="close" hotkey="q" plain role="dismiss" onPress={() => $.ui.close({ id: PANE })}>close</Button>
      </Box>
    )

    if (data.kind !== 'items') {
      return (
        <Box flexDirection="column" rowGap={1}>
          {hint}
          <Text dimColor={data.kind === 'loading'}>
            {data.kind === 'loading' ? 'Reading the backlog…' : data.message}
          </Text>
          {controls}
        </Box>
      )
    }

    const { matching, index } = position(data, filters, current)
    const filterLine = FILTERS.map(({ field }) => `${field}: ${filters[field]}`).join(' · ')
    const fetchNotice =
      data.fetch === 'fetching' ? 'fetching…' : data.fetch === 'failed' ? 'fetch failed: showing last known state' : ''
    const filterRow = (
      <Text wrap="wrap">
        <Text dimColor>{filterLine}</Text>
        {fetchNotice && <Text color={data.fetch === 'failed' ? 'warning' : 'inactive'}>{` · ${fetchNotice}`}</Text>}
      </Text>
    )

    if (matching.length === 0) {
      return (
        <Box flexDirection="column" rowGap={1}>
          {hint}
          <Box flexDirection="column">
            <Text bold>{`0 / 0 (${data.items.length} total)`}</Text>
            {filterRow}
          </Box>
          <Text>No items match the filters</Text>
          {controls}
        </Box>
      )
    }

    const item = matching[index]!
    const version = item.version ? item.version + (item.versionState ? ` (${item.versionState})` : '') : 'no version'
    return (
      <Box flexDirection="column" rowGap={1}>
        {hint}
        <Box flexDirection="column">
          <Text wrap="wrap">
            <Text bold>{`${index + 1} / ${matching.length} (${data.items.length} total)`}</Text>
            <Text dimColor>{` · ${version} · ${item.epic ?? 'no epic'}`}</Text>
          </Text>
          {filterRow}
          {item.source && (
            <Text wrap="wrap">
              <Text color="suggestion">{`from ${item.source}`}</Text>
              {item.alsoIn && <Text color="warning">{` · also in: ${item.alsoIn.join(', ')}`}</Text>}
            </Text>
          )}
        </Box>
        {controls}
        <Text bold wrap="wrap">{`${item.id} — ${item.title}`}</Text>
        <Box flexDirection="column">
          {item.fields.map((field) => (
            <Box flexDirection="column">
              <Text wrap="wrap">
                <Text color="suggestion">{`${field.label}:`}</Text>
                {field.value !== undefined && (
                  <Text
                    color={
                      field.label === 'Status'
                        ? statusColor(field.value)
                        : field.label === 'Priority'
                          ? priorityColor(field.value)
                          : undefined
                    }
                  >{` ${field.value}`}</Text>
                )}
              </Text>
              {(field.list ?? []).map((entry) => (
                <Text wrap="wrap">{`  • ${entry}`}</Text>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    )
  })
}
