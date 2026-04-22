import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export const syncQueuedIncidents = async () => {
    if (!navigator.onLine) return;

    const queue = getQueuedIncidents();
    if (queue.length === 0) return;

    console.log(`Syncing ${queue.length} queued incidents...`);

    for (const queuedIncident of queue) {
        try {
            // Create the incident in Firestore
            const docRef = await addDoc(collection(db, 'emergencies'), {
                ...queuedIncident,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            // OPTIONAL: AI update (only if function exists)
            if (typeof updateIncidentWithAIFields === "function") {
                await updateIncidentWithAIFields(docRef.id, queuedIncident);
            }

            // Remove from queue after success
            removeFromQueue(queuedIncident.id);

        } catch (error) {
            console.error('Failed to sync incident:', error);
        }
    }
};