/** Filter values, as the pi overlay names them. */
export type BacklogFilters = { Type: string; Priority: string; Status: string }

/** A dependency of an item and whether its item is `Done`. */
export type BacklogDependency = { id: string; done: boolean }

/**
 * One line of an item: `label: value`, or a label followed by a list.
 * `dependencies` is set on the Dependencies line when the item has any.
 */
export type BacklogField = { label: string; value?: string; list?: string[]; dependencies?: BacklogDependency[] }

export type BacklogItem = {
  id: string
  title: string
  /** `Version v0.1.0`, absent when unassigned. */
  version?: string
  versionState?: string
  /** `EPIC-001 — Title`. */
  epic?: string
  type: string
  priority: string
  status: string
  fields: BacklogField[]
  /** Some dependency is not `Done` (or not in the backlog). */
  unmetDependencies: boolean
  /** Branch the item was read from, e.g. `origin/task/TEC-007-slug`. */
  source?: string
  /** Other unmerged branches that also carry the item. */
  alsoIn?: string[]
}

export type BacklogFetch = 'none' | 'fetching' | 'failed' | 'done'

export type BacklogData =
  | { kind: 'loading' }
  | { kind: 'message'; message: string }
  | { kind: 'items'; items: BacklogItem[]; fetch: BacklogFetch }

declare module 'claude-code' {
  interface PluginState {
    'backlog-overlay': {
      filters: Shaped<BacklogFilters>
      current: Shaped<string>
      data: Shaped<BacklogData>
    }
  }
}
