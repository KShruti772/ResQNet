// Test imports
import { db } from '../firebase.js'
import {
    collection,
    addDoc,
    doc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    query,
    where,
    onSnapshot,
    runTransaction,
    serverTimestamp,
    arrayUnion
} from 'firebase/firestore'
import { analyzeIncident } from '../../services/geminiService.js'
import { notifyIncidentCreated, notifyStaffAssigned, notifyEscalation, notifyCriticalAlert } from '../../services/notificationService.js';
