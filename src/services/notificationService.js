// Notification service for multi-channel alerting
import nodemailer from 'nodemailer'
import { retryAsync, isOffline, queueOfflineRequest } from '../utils/retryService.js'
import { logActivity, logError } from '../utils/logService.js'

// Email configuration
const EMAIL_USER = import.meta.env.VITE_EMAIL_USER
const EMAIL_PASS = import.meta.env.VITE_EMAIL_PASS

// Create email transporter
const createTransporter = () => {
    if (!EMAIL_USER || !EMAIL_PASS) {
        console.warn('Email credentials not configured. Email notifications will be disabled.')
        return null
    }

    return nodemailer.createTransporter({
        service: 'gmail',
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS
        }
    })
}

// Send email notification
const sendEmail = async (to, subject, text, html = null) => {
    const transporter = createTransporter()
    if (!transporter) return

    try {
        const mailOptions = {
            from: EMAIL_USER,
            to,
            subject,
            text,
            ...(html && { html })
        }

        await transporter.sendMail(mailOptions)
        console.log('Email sent successfully to:', to)
    } catch (error) {
        console.warn('Failed to send email:', error)
    }
}

// Mock SMS notification (for development)
const sendSMS = async (phone, message) => {
    // Mock SMS implementation
    console.log('SMS notification (mock):', { phone, message })
    // In production, integrate with SMS service like Twilio
}

// Browser push notification
const sendPushNotification = async (title, body, icon = '/favicon.ico') => {
    if (!('Notification' in window)) {
        console.warn('Browser does not support notifications')
        return
    }

    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon })
    } else if (Notification.permission !== 'denied') {
        // Request permission
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
            new Notification(title, { body, icon })
        }
    }
}

const queueNotificationIfOffline = async (type, payload) => {
    if (isOffline()) {
        await queueOfflineRequest(type, payload)
        const error = new Error('Offline queued notification')
        error.code = 'OFFLINE_QUEUED'
        throw error
    }
}

const sendEmailAndPush = async (to, subject, text, html) => {
    const transporter = createTransporter()
    if (!transporter) return

    const mailOptions = {
        from: EMAIL_USER,
        to,
        subject,
        text,
        ...(html && { html })
    }

    await transporter.sendMail(mailOptions)
}

// Incident creation notification
export const notifyIncidentCreated = async (emergency, adminEmail) => {
    const subject = `New Emergency Incident: ${emergency.title}`
    const text = `
New emergency incident reported:

Title: ${emergency.title}
Type: ${emergency.type}
Priority: ${emergency.priority}
Location: ${emergency.location?.building || 'N/A'} ${emergency.location?.floor || ''} ${emergency.location?.room || ''}
Description: ${emergency.description}

Please assign staff immediately.
`

    const html = `
<h2>New Emergency Incident</h2>
<p><strong>Title:</strong> ${emergency.title}</p>
<p><strong>Type:</strong> ${emergency.type}</p>
<p><strong>Priority:</strong> ${emergency.priority}</p>
<p><strong>Location:</strong> ${emergency.location?.building || 'N/A'} ${emergency.location?.floor || ''} ${emergency.location?.room || ''}</p>
<p><strong>Description:</strong> ${emergency.description}</p>
<p>Please assign staff immediately.</p>
`

    await queueNotificationIfOffline('notifyIncidentCreated', { emergency, adminEmail })
    await logActivity('NOTIFY_INCIDENT_CREATED', {
        organizationId: emergency.organizationId,
        userId: emergency.userId,
        message: `Sending incident created notification for ${emergency.id}`,
        metadata: { emergencyId: emergency.id, adminEmail }
    })
    await retryAsync(async () => {
        await Promise.all([
            sendEmail(adminEmail, subject, text, html),
            sendPushNotification('New Emergency', `Incident: ${emergency.title}`, '/favicon.ico')
        ])
    }, 3, 1000, { operationName: 'notifyIncidentCreated' })
        .catch(async (error) => {
            await logError(error, {
                action: 'NOTIFY_INCIDENT_CREATED',
                organizationId: emergency.organizationId,
                userId: emergency.userId,
                message: `Failed to send incident created notification for ${emergency.id}`,
                metadata: { emergencyId: emergency.id, adminEmail }
            })
            throw error
        })
}

// Staff assignment notification
export const notifyStaffAssigned = async (emergency, staffEmail, staffPhone) => {
    const subject = `Emergency Assigned: ${emergency.title}`
    const text = `
You have been assigned to an emergency incident:

Title: ${emergency.title}
Type: ${emergency.type}
Priority: ${emergency.priority}
Location: ${emergency.location?.building || 'N/A'} ${emergency.location?.floor || ''} ${emergency.location?.room || ''}
Description: ${emergency.description}

Please respond immediately.
`

    const html = `
<h2>Emergency Assigned</h2>
<p><strong>Title:</strong> ${emergency.title}</p>
<p><strong>Type:</strong> ${emergency.type}</p>
<p><strong>Priority:</strong> ${emergency.priority}</p>
<p><strong>Location:</strong> ${emergency.location?.building || 'N/A'} ${emergency.location?.floor || ''} ${emergency.location?.room || ''}</p>
<p><strong>Description:</strong> ${emergency.description}</p>
<p>Please respond immediately.</p>
`

    await queueNotificationIfOffline('notifyStaffAssigned', { emergency, staffEmail, staffPhone })
    await logActivity('NOTIFY_STAFF_ASSIGNED', {
        organizationId: emergency.organizationId,
        userId: emergency.userId,
        message: `Sending staff assignment notification for ${emergency.id}`,
        metadata: { emergencyId: emergency.id, staffEmail, staffPhone }
    })
    await retryAsync(async () => {
        await Promise.all([
            sendEmail(staffEmail, subject, text, html),
            sendSMS(staffPhone, text),
            sendPushNotification('Emergency Assigned', `Incident: ${emergency.title}`, '/favicon.ico')
        ])
    }, 3, 1000, { operationName: 'notifyStaffAssigned' })
        .catch(async (error) => {
            await logError(error, {
                action: 'NOTIFY_STAFF_ASSIGNED',
                organizationId: emergency.organizationId,
                userId: emergency.userId,
                message: `Failed to send staff assigned notification for ${emergency.id}`,
                metadata: { emergencyId: emergency.id, staffEmail, staffPhone }
            })
            throw error
        })
}

// Escalation notification
export const notifyEscalation = async (emergency, adminEmail, newStaffEmail, newStaffPhone) => {
    const subject = `Emergency Escalated: ${emergency.title}`
    const text = `
Emergency incident has been escalated to the next staff level:

Title: ${emergency.title}
Type: ${emergency.type}
Priority: ${emergency.priority}
Escalation Level: ${emergency.escalation_level}
Location: ${emergency.location?.building || 'N/A'} ${emergency.location?.floor || ''} ${emergency.location?.room || ''}
Description: ${emergency.description}

New staff has been assigned.
`

    const html = `
<h2>Emergency Escalated</h2>
<p><strong>Title:</strong> ${emergency.title}</p>
<p><strong>Type:</strong> ${emergency.type}</p>
<p><strong>Priority:</strong> ${emergency.priority}</p>
<p><strong>Escalation Level:</strong> ${emergency.escalation_level}</p>
<p><strong>Location:</strong> ${emergency.location?.building || 'N/A'} ${emergency.location?.floor || ''} ${emergency.location?.room || ''}</p>
<p><strong>Description:</strong> ${emergency.description}</p>
<p>New staff has been assigned.</p>
`

    await queueNotificationIfOffline('notifyEscalation', { emergency, adminEmail, newStaffEmail, newStaffPhone })
    await logActivity('NOTIFY_ESCALATION', {
        organizationId: emergency.organizationId,
        userId: emergency.userId,
        message: `Sending escalation notification for ${emergency.id}`,
        metadata: { emergencyId: emergency.id, adminEmail, newStaffEmail }
    })
    await retryAsync(async () => {
        await Promise.all([
            sendEmail(adminEmail, subject, text, html),
            sendEmail(newStaffEmail, subject, text, html),
            sendSMS(newStaffPhone, text),
            sendPushNotification('Emergency Escalated', `Incident: ${emergency.title}`, '/favicon.ico')
        ])
    }, 3, 1000, { operationName: 'notifyEscalation' })
        .catch(async (error) => {
            await logError(error, {
                action: 'NOTIFY_ESCALATION',
                organizationId: emergency.organizationId,
                userId: emergency.userId,
                message: `Failed to send escalation notification for ${emergency.id}`,
                metadata: { emergencyId: emergency.id, adminEmail, newStaffEmail }
            })
            throw error
        })
}

// Critical alert notification
export const notifyCriticalAlert = async (emergency, adminEmail) => {
    const subject = `CRITICAL EMERGENCY: ${emergency.title}`
    const text = `
CRITICAL EMERGENCY ALERT:

Title: ${emergency.title}
Type: ${emergency.type}
Priority: ${emergency.priority}
Status: ${emergency.status}
Location: ${emergency.location?.building || 'N/A'} ${emergency.location?.floor || ''} ${emergency.location?.room || ''}
Description: ${emergency.description}

IMMEDIATE ACTION REQUIRED!
`

    const html = `
<h1 style="color: red;">CRITICAL EMERGENCY ALERT</h1>
<p><strong>Title:</strong> ${emergency.title}</p>
<p><strong>Type:</strong> ${emergency.type}</p>
<p><strong>Priority:</strong> ${emergency.priority}</p>
<p><strong>Status:</strong> ${emergency.status}</p>
<p><strong>Location:</strong> ${emergency.location?.building || 'N/A'} ${emergency.location?.floor || ''} ${emergency.location?.room || ''}</p>
<p><strong>Description:</strong> ${emergency.description}</p>
<p style="color: red; font-weight: bold;">IMMEDIATE ACTION REQUIRED!</p>
`

    await queueNotificationIfOffline('notifyCriticalAlert', { emergency, adminEmail })
    await logActivity('NOTIFY_CRITICAL_ALERT', {
        organizationId: emergency.organizationId,
        userId: emergency.userId,
        message: `Sending critical alert notification for ${emergency.id}`,
        metadata: { emergencyId: emergency.id, adminEmail }
    })
    await retryAsync(async () => {
        await Promise.all([
            sendEmail(adminEmail, subject, text, html),
            sendPushNotification('CRITICAL EMERGENCY', `Incident: ${emergency.title}`, '/favicon.ico')
        ])
    }, 3, 1000, { operationName: 'notifyCriticalAlert' })
        .catch(async (error) => {
            await logError(error, {
                action: 'NOTIFY_CRITICAL_ALERT',
                organizationId: emergency.organizationId,
                userId: emergency.userId,
                message: `Failed to send critical alert notification for ${emergency.id}`,
                metadata: { emergencyId: emergency.id, adminEmail }
            })
            throw error
        })
}