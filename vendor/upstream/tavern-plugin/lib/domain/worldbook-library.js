import { mergeWorldBooks } from './worldbook-merge.js'
import { exportCharacterBook, exportSillyTavernWorldBook, inspectWorldBookDocument, prepareWorldBookImport, updateWorldBookDocument, worldBookDisplayName } from './worldbook-resource.js'
import { freezeJsonProjection, createJsonProjectionCache } from './immutable-json-projection.js'

function str(value) {
  return typeof value === 'string' ? value : (value === undefined || value === null ? '' : String(value))
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function embeddedDocument(card) {
  return card && card.character_book && typeof card.character_book === 'object'
    ? card.character_book
    : { name: str(card && card.name) + '世界书', entries: [], extensions: {} }
}

/**
 * Owns world-book identity, storage adapters and card binding semantics.
 * Callers never branch on embedded versus standalone persistence.
 */
export function createWorldBookLibrary(options = {}) {
  const resources = options.resources
  const cards = options.cards
  const normalizePath = options.normalizePath
  const removeStandalone = options.removeStandalone
  const templateRecords = createJsonProjectionCache(), templateSnapshots = new WeakMap()
  const emptyTemplateSnapshot = freezeJsonProjection({ worldName: '', worldbooks: {} })
  let globalWrite = Promise.resolve()
  if (!resources || !cards || typeof normalizePath !== 'function' || typeof removeStandalone !== 'function') {
    throw new Error('World Book Library 缺少资源、人物卡或路径 adapter')
  }

  function sourceOf(locator) {
    const source = locator && typeof locator === 'object' ? locator : {}
    if (source.kind === 'card') {
      return { kind: 'card', cardPath: normalizePath(source.cardPath, 'card') }
    }
    return { kind: 'standalone', path: normalizePath(source.path, 'worldbook') }
  }

  const sourceKey = source => JSON.stringify(sourceOf(source))
  async function globalBooks() {
    const saved = await options.globalStore?.read()
    return (saved?.books || []).map(item => ({ source: sourceOf(item.source), alwaysOn: item.alwaysOn === true }))
  }
  function editGlobals(change) {
    const task = globalWrite.then(async () => {
      if (!options.globalStore) throw new Error('全域世界書儲存尚未就緒')
      const books = await change(await globalBooks())
      await options.globalStore.write({ version: 1, books })
      return books
    })
    globalWrite = task.catch(() => {})
    return task
  }
  async function setGlobal(locator, settings) {
    const source = sourceOf(locator), key = sourceKey(source)
    if (typeof settings?.enabled !== 'boolean' || typeof settings?.alwaysOn !== 'boolean') throw new Error('全域共用與常駐設定必須是布林值')
    if (settings.enabled) {
      await readRecord(source)
      if (source.kind === 'card' && !(await cards.read(source.cardPath))?.character_book) throw new Error('該人物卡沒有內置世界書')
    }
    return editGlobals(books => {
      const index = books.findIndex(item => sourceKey(item.source) === key)
      if (!settings.enabled) return books.filter(item => sourceKey(item.source) !== key)
      const entry = { source, alwaysOn: settings.alwaysOn }
      if (index < 0) books.push(entry)
      else books[index] = entry
      return books
    })
  }
  async function renameGlobal(from, to) {
    if (!(await globalBooks()).some(item => (item.source.path || item.source.cardPath) === from)) return
    await editGlobals(books => books.map(item => {
      if ((item.source.path || item.source.cardPath) !== from) return item
      return { ...item, source: sourceOf(item.source.kind === 'card' ? { kind: 'card', cardPath: to } : { kind: 'standalone', path: to }) }
    }))
  }
  async function removeGlobalPath(path) {
    if (!(await globalBooks()).some(item => (item.source.path || item.source.cardPath) === path)) return
    await editGlobals(books => books.filter(item => (item.source.path || item.source.cardPath) !== path))
  }

  function templateRecord(text, source, filename) {
    const key = JSON.stringify([source, filename])
    return templateRecords(key, text, () => {
      let document
      try { document = JSON.parse(text) } catch (error) { throw new Error('世界书工作版 JSON 损坏: ' + error.message) }
      return { source: clone(source), document: exportSillyTavernWorldBook(document),
        view: { displayName: worldBookDisplayName(document, { filename }) } }
    })
  }

  async function readRecord(locator, suppliedCard, templateOnly = false) {
    const source = sourceOf(locator)
    if (source.kind === 'card') {
      const card = suppliedCard ?? await cards.read(source.cardPath)
      if (card === undefined) throw new Error('人物卡不存在: ' + source.cardPath)
      const document = embeddedDocument(card)
      if (templateOnly) return templateRecord(JSON.stringify(document),
        { kind: 'card', cardPath: source.cardPath, cardName: card.name }, card.name)
      return {
        source: { kind: 'card', cardPath: source.cardPath, cardName: card.name },
        document,
        view: inspectWorldBookDocument(document, { filename: card.name })
      }
    }
    const text = await resources.readText(source.path)
    if (text === undefined) throw new Error('世界书不存在: ' + source.path)
    if (templateOnly) return templateRecord(text, source, source.path.split('/').pop())
    let document
    try { document = JSON.parse(text) } catch (error) { throw new Error('世界书工作版 JSON 损坏: ' + error.message) }
    return {
      source,
      document,
      view: inspectWorldBookDocument(document, { filename: source.path.split('/').pop() })
    }
  }

  async function get(locator) {
    const record = await readRecord(locator)
    return { source: record.source, view: record.view }
  }

  async function catalog() {
    const standaloneResults = await Promise.all((await resources.list('worldbook')).map(async function (path) {
      try {
        const [record, metadata] = await Promise.all([
          readRecord({ kind: 'standalone', path }),
          typeof resources.metadata === 'function' ? resources.metadata(path) : null
        ])
        return { row: {
          kind: 'standalone', path: record.source.path, name: record.view.displayName,
          entryCount: record.view.entryCount, enabledCount: record.view.enabledCount,
          diagnostics: record.view.diagnostics.length,
          importedAt: Math.max(0, Number(metadata && metadata.importedAt) || 0),
          updatedAt: Math.max(0, Number(metadata && metadata.updatedAt) || 0)
        } }
      } catch (error) {
        return { diagnostic: { kind: 'standalone', path, message: str(error && error.message || error) } }
      }
    }))
    const embeddedResults = await Promise.all((await cards.listPaths()).map(async function (cardPath) {
      try {
        const [card, metadata] = await Promise.all([
          cards.read(cardPath),
          typeof cards.metadata === 'function' ? cards.metadata(cardPath) : null
        ])
        if (!card || !card.character_book || typeof card.character_book !== 'object') return {}
        const view = inspectWorldBookDocument(card.character_book, { filename: card.name })
        return { row: {
          kind: 'card', cardPath, cardName: card.name, name: view.displayName,
          entryCount: view.entryCount, enabledCount: view.enabledCount,
          diagnostics: view.diagnostics.length,
          importedAt: Math.max(0, Number(metadata && metadata.importedAt) || 0),
          updatedAt: Math.max(0, Number(metadata && metadata.updatedAt) || 0)
        } }
      } catch (error) {
        return { diagnostic: { kind: 'card', path: cardPath, message: str(error && error.message || error) } }
      }
    }))
    const standalone = standaloneResults.map(function (result) { return result.row }).filter(Boolean)
    const embedded = embeddedResults.map(function (result) { return result.row }).filter(Boolean)
    const diagnostics = standaloneResults.concat(embeddedResults).map(function (result) { return result.diagnostic }).filter(Boolean)
    return { standalone, embedded, diagnostics, globalBooks: await globalBooks() }
  }

  async function binding(cardPath, { card: suppliedCard, read = readRecord } = {}) {
    const normalized = normalizePath(cardPath, 'card')
    const card = suppliedCard ?? await cards.read(normalized)
    if (card === undefined) throw new Error('人物卡不存在: ' + normalized)
    const stored = await resources.bindingForCard(normalized)
    if (stored.kind === 'multiple') {
      const books = await Promise.all(stored.sources.map(async item => {
        const source = sourceOf(item.kind === 'embedded' ? { kind: 'card', cardPath: item.cardPath } : item)
        const kind = source.kind === 'card' ? 'embedded' : 'standalone'
        if (!item.available) return { kind, source, name: '', available: false }
        const record = await read(source)
        return { kind, source: record.source, name: record.view.displayName, available: true }
      }))
      if (books.length === 0) return { kind: 'none', source: null, name: '', available: true }
      if (books.length === 1) return books[0]
      return { kind: 'multiple', books, source: books[0].source, name: books.map(book => book.name || '世界书不可用').join('、'), available: books.every(book => book.available) }
    }
    if (stored.kind === 'none') return { kind: 'none', source: null, name: '', available: true }
    if (stored.kind === 'standalone') {
      const source = { kind: 'standalone', path: stored.path }
      if (stored.available !== true) return { kind: 'standalone', source, name: '', available: false }
      try {
        const record = await read(source)
        return { kind: 'standalone', source, name: record.view.displayName, available: true }
      } catch (error) {
        if (/世界书不存在/.test(str(error && error.message))) return { kind: 'standalone', source, name: '', available: false }
        throw error
      }
    }
    if (stored.kind === 'embedded') {
      const source = { kind: 'card', cardPath: stored.cardPath }
      if (stored.available !== true) return { kind: 'embedded', source, name: '', available: false }
      try {
        const record = await read(source)
        return { kind: 'embedded', source: record.source, name: record.view.displayName, available: true }
      } catch (error) {
        if (/人物卡不存在/.test(str(error && error.message))) return { kind: 'embedded', source, name: '', available: false }
        throw error
      }
    }
    if (card.character_book && typeof card.character_book === 'object') {
      const record = await read({ kind: 'card', cardPath: normalized })
      return { kind: 'embedded', source: record.source, name: record.view.displayName, available: true }
    }
    return { kind: 'none', source: null, name: '', available: true }
  }

  function bindingMatchesSource(current, source) {
    if (current?.kind === 'multiple') return current.books.some(book => bindingMatchesSource(book, source))
    if (!current || !current.source) return false
    if (source.kind === 'card') {
      return current.kind === 'embedded' && current.source.cardPath === source.cardPath
    }
    return current.kind === 'standalone' && current.source.path === source.path
  }

  async function associations(locator) {
    const source = sourceOf(locator)
    const cardPaths = await cards.listPaths()
    const cardRows = []
    for (const cardPath of cardPaths) {
      const card = await cards.read(cardPath)
      if (card === undefined) continue
      const current = await binding(cardPath)
      cardRows.push({
        path: cardPath,
        name: str(card.name),
        bound: bindingMatchesSource(current, source),
        binding: current
      })
    }
    const boundCards = cardRows.filter(function (card) { return card.bound }).map(function (card) {
      return { path: card.path, name: card.name }
    })
    const global = (await globalBooks()).find(item => sourceKey(item.source) === sourceKey(source))
    return { source, cards: cardRows, boundCards, conflict: false, global: { enabled: Boolean(global), alwaysOn: global?.alwaysOn === true } }
  }

  async function resolveBound(cardPath, card, chat, templateOnly = false) {
    if(options.enabled?.() === false)return null
    if (chat?.openingWorldbookSnapshot?.version === 1) {
      const snapshot = chat.openingWorldbookSnapshot
      if (snapshot.document === null) return null
      if (templateOnly) return templateRecord(JSON.stringify(snapshot.document), snapshot.source)
      return { source: clone(snapshot.source), document: clone(snapshot.document),
        localChatId: chat.id, view: inspectWorldBookDocument(snapshot.document) }
    }
    // This resolver lives for one bound read only. Binding metadata, the view
    // and the exported document must describe the same resource observation.
    const records = new Map()
    const normalizedCardPath = normalizePath(cardPath, 'card')
    card ??= await cards.read(normalizedCardPath)
    if (card === undefined) throw new Error('人物卡不存在: ' + normalizedCardPath)
    function read(locator) {
      const source = sourceOf(locator)
      const key = JSON.stringify(source)
      if (!records.has(key)) records.set(key, readRecord(source,
        source.kind === 'card' && source.cardPath === normalizedCardPath ? card : undefined, templateOnly))
      return records.get(key)
    }
    const current = await binding(cardPath, { card, read })
    if (current.available !== true) throw new Error('绑定的世界书不存在，请重新绑定或解绑')
    const localBooks = current.kind === 'multiple' ? current.books : current.source ? [current] : []
    const resolved = await Promise.all(localBooks.map(book => read(book.source)))
    for (const item of await globalBooks()) {
      const index = resolved.findIndex(record => sourceKey(record.source) === sourceKey(item.source))
      let record = index < 0 ? await read(item.source) : resolved[index]
      if (item.alwaysOn) {
        const document = exportSillyTavernWorldBook(record.document ?? record.view.raw)
        for (const entry of Object.values(document.entries)) entry.constant = true
        record = { ...record, document, view: inspectWorldBookDocument(document) }
      }
      if (index < 0) resolved.push(record)
      else resolved[index] = record
    }
    if (!resolved.length) return null
    if (resolved.length > 1) {
      const merged = mergeWorldBooks(resolved)
      if (templateOnly) return templateRecord(JSON.stringify(merged.document), { kind: 'merged', sources: resolved.map(record => record.source) })
      return { source: { kind: 'merged', sources: resolved.map(record => record.source) }, document: merged.document, localChatId: chat?.id, mergedSources: merged.sources, view: inspectWorldBookDocument(merged.document) }
    }
    return resolved[0]
  }

  async function bound(cardPath, card, chat) { return await resolveBound(cardPath, card, chat) }

  async function templateSnapshot(cardPath, card, chat) {
    const record = await resolveBound(cardPath, card, chat, true)
    if (!record) return emptyTemplateSnapshot
    let snapshot = templateSnapshots.get(record)
    if (!snapshot) {
      const worldName = record.view.displayName
      snapshot = freezeJsonProjection({ worldName, worldbooks: { [worldName]: record.document } })
      templateSnapshots.set(record, snapshot)
    }
    return snapshot
  }

  async function bind(cardPath, locator) {
    const normalized = normalizePath(cardPath, 'card')
    const card = await cards.read(normalized)
    if (card === undefined) throw new Error('人物卡不存在: ' + normalized)
    const source = sourceOf(locator)
    if (source.kind === 'card') {
      const owner = await cards.read(source.cardPath)
      if (owner === undefined) throw new Error('人物卡不存在: ' + source.cardPath)
      if (!owner.character_book || typeof owner.character_book !== 'object') throw new Error('该人物卡没有自带世界书')
    }
    const current = await binding(normalized)
    if (bindingMatchesSource(current, source)) return current
    const books = current.kind === 'multiple' ? current.books : current.source ? [current] : []
    return await setBindings(normalized, books.map(book => book.source).concat([source]))
  }

  async function setBindings(cardPath, locators) {
    const normalized = normalizePath(cardPath, 'card')
    if (!Array.isArray(locators)) throw new Error('世界书绑定需要有序列表')
    const sources = locators.map(sourceOf)
    const identities = sources.map(source => JSON.stringify(source))
    if (new Set(identities).size !== identities.length) throw new Error('不能重复绑定同一本世界书')
    for (const source of sources) {
      await readRecord(source)
      if (source.kind === 'card') {
        const owner = await cards.read(source.cardPath)
        if (!owner?.character_book) throw new Error('该人物卡没有自带世界书')
      }
    }
    await resources.bindMany(normalized, sources.map(source => source.kind === 'card' ? { kind: 'embedded', cardPath: source.cardPath } : source))
    return await binding(normalized)
  }

  async function unbind(cardPath, locator) {
    if (!locator) { await resources.unbind(cardPath); return await binding(cardPath) }
    const current = await binding(cardPath)
    const books = current.kind === 'multiple' ? current.books : current.source ? [current] : []
    const source = sourceOf(locator)
    return await setBindings(cardPath, books.filter(book => !bindingMatchesSource(book, source)).map(book => book.source))
  }

  async function importBook(payload) {
    const prepared = prepareWorldBookImport(payload)
    const path = await resources.import(prepared, prepared.working)
    const record = await readRecord({ kind: 'standalone', path })
    return { kind: 'standalone', path, name: record.view.displayName, entryCount: record.view.entryCount }
  }

  async function update(locator, request) {
    const record = await readRecord(locator)
    const changed = updateWorldBookDocument(record.document, request)
    if (record.source.kind === 'card') {
      await cards.update(record.source.cardPath, { character_book: changed.document })
    } else {
      await resources.write(record.source.path, JSON.stringify(changed.document, null, 2))
    }
    return await get(record.source)
  }

  /** Replace through the native ST API, preserving unknown plugin fields. */
  async function replaceNative(locator, document) {
    if (!document || typeof document !== 'object' || Array.isArray(document)
      || !document.entries || typeof document.entries !== 'object' || Array.isArray(document.entries)) {
      throw new Error('原生世界书需要 entries 对象')
    }
    const ids = new Set()
    for (const [key, entry] of Object.entries(document.entries)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !Number.isSafeInteger(entry.uid)
        || entry.uid < 0 || String(entry.uid) !== key || ids.has(entry.uid)) throw new Error('世界书条目编号无效或重复')
      ids.add(entry.uid)
    }
    const record = await readRecord(locator)
    const native = clone(document)
    // originalData is conversion provenance, never a second writable authority.
    delete native.originalData
    if (record.source.kind === 'card') {
      await cards.update(record.source.cardPath, { character_book: exportCharacterBook(native, { replace: true }) })
    } else {
      await resources.write(record.source.path, JSON.stringify(native, null, 2))
    }
    return await get(record.source)
  }

  async function exportBook(locator) {
    const record = await readRecord(locator)
    return { name: record.view.displayName, document: exportSillyTavernWorldBook(record.document) }
  }

  async function characterBookForCard(cardPath) {
    const record = await bound(cardPath)
    if (!record) return null
    return exportCharacterBook(record.document || record.view.raw)
  }

  async function remove(locator) {
    const source = sourceOf(typeof locator === 'string' ? { kind: 'standalone', path: locator } : locator)
    if (source.kind === 'standalone') return await removeStandalone(source.path)
    await readRecord(source)
    const relations = await associations(source)
    for (const card of relations.boundCards) await unbind(card.path, source)
    await cards.update(source.cardPath, { character_book: null })
    if ((await globalBooks()).some(item => sourceKey(item.source) === sourceKey(source))) await setGlobal(source, { enabled: false, alwaysOn: false })
    return { removed: source.cardPath, kind: 'embedded' }
  }

  return Object.freeze({ catalog, get, binding, associations, bound, templateSnapshot, bind, setBindings, unbind, globalBooks, setGlobal, renameGlobal, removeGlobalPath, import: importBook, update, replaceNative, export: exportBook, characterBookForCard, remove })
}
