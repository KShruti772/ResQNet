const QUEUE_STORAGE_KEY = 'resqnet-offline-requests'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const isOffline = () => typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine

export const retryAsync = async (fn, retries = 3, delayMs = 1000, options = {}) => {
    const operationName = options.operationName || fn.name || 'operation'
    let lastError = null

    for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
            if (attempt > 1) {
                console.info(`[retryAsync] attempt ${attempt}/${retries} for ${operationName}`)
            }
            const result = await fn(attempt)
            if (attempt > 1) {
                console.info(`[retryAsync] succeeded on attempt ${attempt}/${retries} for ${operationName}`)
            }
            return result
        } catch (error) {
            lastError = error
            console.warn(`[retryAsync] failed attempt ${attempt}/${retries} for ${operationName}`, {
                message: error?.message,
                code: error?.code
            })
            if (attempt >= retries) {
                break
            }
            const backoff = delayMs * Math.pow(2, attempt - 1)
            await wait(backoff)
        }
    }

    const retryError = new Error(`Retry failed for ${operationName}: ${lastError?.message || 'Unknown error'}`)
    retryError.originalError = lastError
    retryError.attempts = retries
    retryError.code = lastError?.code || 'RETRY_FAILED'
    throw retryError
}

const safeParseQueue = (queueJson) => {
    try {
        const decoded = JSON.parse(queueJson || '[]')
        return Array.isArray(decoded) ? decoded : []
    } catch (error) {
        console.warn('[retryService] Failed to parse queue', error)
        return []
    }
}

export const getQueuedRequests = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return []
    }

    return safeParseQueue(window.localStorage.getItem(QUEUE_STORAGE_KEY))
}

const writeQueuedRequests = (queue) => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return
    }

    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue))
}

const createQueueEntry = (type, payload) => {
    return {
        id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type,
        payload,
        attempts: 0,
        createdAt: new Date().toISOString(),
        lastError: null
    }
}

export const queueOfflineRequest = async (type, payload) => {
    const entry = createQueueEntry(type, payload)
    const queue = getQueuedRequests()
    queue.push(entry)
    writeQueuedRequests(queue)
    console.info(`[retryService] queued offline request: ${type}`, { id: entry.id })
    return entry
}

export const getQueuedRequestCount = () => getQueuedRequests().length

export const clearQueuedRequests = () => {
    if (typeof window === 'undefined' || !window.localStorage) {
        return
    }
    window.localStorage.removeItem(QUEUE_STORAGE_KEY)
}

export const syncQueuedRequests = async (handlers = {}) => {
    if (isOffline()) {
        console.info('[retryService] offline, skipping queued request sync')
        return { synced: 0, remaining: getQueuedRequestCount() }
    }

    const queue = getQueuedRequests()
    if (!queue.length) {
        return { synced: 0, remaining: 0 }
    }

    const remainingQueue = []
    let syncedCount = 0

    for (const entry of queue) {
        const handler = handlers[entry.type]
        if (typeof handler !== 'function') {
            console.warn(`[retryService] no handler for queued request type: ${entry.type}`)
            remainingQueue.push(entry)
            continue
        }

        try {
            entry.attempts += 1
            await retryAsync(() => handler(entry.payload), 3, 1000, { operationName: entry.type })
            syncedCount += 1
            console.info(`[retryService] synced queued request ${entry.id}`)
        } catch (error) {
            console.warn(`[retryService] queued request failed again: ${entry.id}`, {
                message: error?.message,
                code: error?.code,
                attempts: entry.attempts
            })
            entry.lastError = error?.message || 'Unknown error'
            remainingQueue.push(entry)
        }
    }

    writeQueuedRequests(remainingQueue)
    return { synced: syncedCount, remaining: remainingQueue.length }
}

export const subscribeOnlineSync = (handlers = {}) => {
    if (typeof window === 'undefined' || !window.addEventListener) {
        return () => { }
    }

    const flush = async () => {
        try {
            await syncQueuedRequests(handlers)
        } catch (error) {
            console.warn('[retryService] online flush failed', error)
        }
    }

    window.addEventListener('online', flush)
    if (navigator.onLine) {
        flush()
    }

    return () => {
        window.removeEventListener('online', flush)
    }
}
