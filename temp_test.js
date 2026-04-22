// Offline queue management
const OFFLINE_QUEUE_KEY = 'offline_incidents_queue'

const saveToLocalQueue = (incidentData) => {
    try {
        const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
        const queuedIncident = {
            id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...incidentData,
            queuedAt: new Date().toISOString(),
            syncStatus: 'pending'
        }
        queue.push(queuedIncident)
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
        return queuedIncident.id
    } catch (error) {
        console.error('Failed to save incident to local queue:', error)
        throw error
    }
}

export const getQueuedIncidents = () => {
    try {
        return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
    } catch (error) {
        console.error('Failed to get queued incidents:', error)
        return []
    }
}

const removeFromQueue = (incidentId) => {
    try {
        const queue = getQueuedIncidents()
        const updatedQueue = queue.filter(item => item.id !== incidentId)
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updatedQueue))
    } catch (error) {
        console.error('Failed to remove incident from queue:', error)
    }
}

export const syncQueuedIncidents = async () => {
    if (!navigator.onLine) return

    const queue = getQueuedIncidents()
    if (queue.length === 0) return

    console.log(`Syncing ${queue.length} queued incidents...`)

    for (const queuedIncident of queue) {
        try {
            const docRef = await addDoc(collection(db, 'emergencies'), {
                ...queuedIncident,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            })

            // Fix: complete function call
            await updateIncidentWithAIFields(docRef.id, queuedIncident)

            removeFromQueue(queuedIncident.id)

        } catch (error) {
            console.error('Failed to sync incident:', error)
        }
    }
}