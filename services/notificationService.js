const EMAIL_WEBHOOK_URL = import.meta.env.VITE_EMAIL_WEBHOOK_URL || ''

const isBrowserNotificationSupported = () => typeof window !== 'undefined' && 'Notification' in window

const sendEmailWebhook = async (to, subject, html) => {
    if (!EMAIL_WEBHOOK_URL) {
        console.warn('Email webhook URL not configured. Skipping email notification.')
        return false
    }

    try {
        const response = await fetch(EMAIL_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ to, subject, html })
        })

        if (!response.ok) {
            throw new Error(`Email webhook failed with status ${response.status}`)
        }

        console.log(`📧 Email webhook queued for ${to}: ${subject}`)
        return true
    } catch (error) {
        console.error('Failed to send email via webhook:', error)
        return false
    }
}

// Mock SMS service (for demo purposes)
const sendSMSMock = async (phone, message) => {
    console.log(`📱 SMS to ${phone}: ${message}`)
    // In production, integrate with Twilio or similar service
    return true
}

const sendBrowserNotification = async (title, body, icon = '/favicon.ico') => {
    if (!isBrowserNotificationSupported()) {
        console.warn('Push notifications are not supported in this environment.')
        return false
    }

    if (Notification.permission === 'default') {
        await Notification.requestPermission()
    }

    if (Notification.permission !== 'granted') {
        console.warn('Push notification permission not granted.')
        return false
    }

    new Notification(title, {
        body,
        icon,
        tag: 'emergency-alert'
    })

    return true
}

export const sendEmail = async (to, subject, html) => {
    try {
        if (!to) {
            console.warn('No recipient provided for email notification. Skipping.')
            return false
        }

        return await sendEmailWebhook(to, subject, html)
    } catch (error) {
        console.error('Failed to send email:', error)
        return false
    }
}

export const sendSMS = async (phone, message) => {
    try {
        if (!phone) {
            console.warn('No phone number provided for SMS notification. Skipping.')
            return false
        }

        return await sendSMSMock(phone, message)
    } catch (error) {
        console.error('Failed to send SMS:', error)
        return false
    }
}

export const sendPush = async (title, body) => {
    try {
        return await sendBrowserNotification(title, body)
    } catch (error) {
        console.error('Failed to send push notification:', error)
        return false
    }
}

const formatTimeElapsed = (createdAt) => {
    if (!createdAt?.seconds) {
        return 'unknown'
    }

    const elapsedSeconds = Math.floor((Date.now() - createdAt.seconds * 1000) / 1000)
    return `${elapsedSeconds} seconds`
}

// Main notification functions
export const notifyIncidentCreated = async (incident, adminEmail) => {
    try {
        console.log('📧 Preparing incident created notification', { incidentId: incident.id, adminEmail })

        const subject = `🚨 New Emergency Incident: ${incident.title || 'Untitled'}`
        const html = `
            <h2>New Emergency Incident Created</h2>
            <p><strong>Title:</strong> ${incident.title || 'N/A'}</p>
            <p><strong>Description:</strong> ${incident.description || 'N/A'}</p>
            <p><strong>Location:</strong> ${incident.location || 'Not specified'}</p>
            <p><strong>Priority:</strong> ${incident.priority || 'medium'}</p>
            <p><strong>Type:</strong> ${incident.type || incident.emergencyType || 'general'}</p>
            <p><strong>Reported by:</strong> ${incident.userName || 'Unknown'}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <br>
            <p>Please review and assign staff as needed.</p>
        `

        const emailSent = await sendEmail(adminEmail, subject, html)
        const pushSent = await sendPush('New Incident Created', `Incident: ${incident.title || 'New incident'}`)

        console.log('📧 Incident created notifications sent', { emailSent, pushSent })
        return { emailSent, pushSent }
    } catch (error) {
        console.error('❌ Failed to send incident created notifications:', error)
        // Don't throw - notifications are not critical
        return { emailSent: false, pushSent: false, error: error.message }
    }
}

export const notifyStaffAssigned = async (incident, staffEmail, staffPhone) => {
    try {
        console.log('👤 Preparing staff assignment notification', { incidentId: incident.id, staffEmail, staffPhone })

        const subject = `🚨 Emergency Assignment: ${incident.title || 'New Assignment'}`
        const html = `
            <h2>You have been assigned to an emergency</h2>
            <p><strong>Incident:</strong> ${incident.title || 'N/A'}</p>
            <p><strong>Description:</strong> ${incident.description || 'N/A'}</p>
            <p><strong>Location:</strong> ${incident.location || 'Not specified'}</p>
            <p><strong>Priority:</strong> ${incident.priority || 'medium'}</p>
            <p><strong>Type:</strong> ${incident.type || incident.emergencyType || 'general'}</p>
            <p><strong>Reported by:</strong> ${incident.userName || 'Unknown'}</p>
            <p><strong>SLA:</strong> ${incident.sla_limit || 300} seconds</p>
            <br>
            <p>Please respond immediately to this emergency.</p>
        `

        const emailSent = await sendEmail(staffEmail, subject, html)
        const smsSent = await sendSMS(staffPhone, `EMERGENCY ASSIGNMENT: ${incident.title || 'New incident'} at ${incident.location || 'Unknown location'}. Priority: ${incident.priority || 'medium'}`)
        const pushSent = await sendPush('Emergency Assignment', `Assigned to: ${incident.title || 'New incident'}`)

        console.log('👤 Staff assignment notifications sent', { emailSent, smsSent, pushSent })
        return { emailSent, smsSent, pushSent }
    } catch (error) {
        console.error('❌ Failed to send staff assignment notifications:', error)
        return { emailSent: false, smsSent: false, pushSent: false, error: error.message }
    }
}

export const notifyEscalation = async (incident, adminEmail, nextStaffEmail, nextStaffPhone) => {
    try {
        console.log('⚠️ Preparing escalation notification', { incidentId: incident?.id, adminEmail, nextStaffEmail, nextStaffPhone })

        const subject = `⚠️ Emergency Escalated: ${incident?.title || 'New Escalation'}`
        const html = `
            <h2>Emergency Incident Escalated</h2>
            <p><strong>Incident:</strong> ${incident?.title || 'N/A'}</p>
            <p><strong>Description:</strong> ${incident?.description || 'N/A'}</p>
            <p><strong>Location:</strong> ${incident?.location || 'Not specified'}</p>
            <p><strong>Current Priority:</strong> ${incident?.priority || 'medium'}</p>
            <p><strong>Escalation Level:</strong> ${incident?.escalation_level || 1}</p>
            <p><strong>Time Elapsed:</strong> ${formatTimeElapsed(incident?.createdAt)}</p>
            <br>
            <p>The incident has been escalated and reassigned.</p>
        `

        const emailSent = await sendEmail(adminEmail, subject, html)
        let escalationEmailSent = false
        let smsSent = false

        if (nextStaffEmail) {
            escalationEmailSent = await sendEmail(nextStaffEmail, `🚨 URGENT: Escalated Emergency - ${incident?.title || 'New incident'}`, html)
        }

        if (nextStaffPhone) {
            smsSent = await sendSMS(nextStaffPhone, `URGENT ESCALATION: ${incident?.title || 'New incident'} at ${incident?.location || 'Unknown location'}. Level: ${incident?.escalation_level || 1}`)
        }

        const pushSent = await sendPush('Emergency Escalated', `Incident escalated: ${incident?.title || 'New incident'}`)

        console.log('⚠️ Escalation notifications sent', { emailSent, escalationEmailSent, smsSent, pushSent })
        return { emailSent, escalationEmailSent, smsSent, pushSent }
    } catch (error) {
        console.error('❌ Failed to send escalation notifications:', error)
        return { emailSent: false, escalationEmailSent: false, smsSent: false, pushSent: false, error: error.message }
    }
}

export const notifyCriticalAlert = async (incident, adminEmail, staffEmails = []) => {
    try {
        console.log('🚨 Preparing critical alert notification', { incidentId: incident?.id, adminEmail, staffCount: staffEmails?.length || 0 })

        const subject = `🚨🚨 CRITICAL EMERGENCY: ${incident?.title || 'Critical Incident'}`
        const html = `
            <h2>CRITICAL EMERGENCY ALERT</h2>
            <p style="color: red; font-size: 18px;"><strong>INCIDENT:</strong> ${incident?.title || 'N/A'}</p>
            <p><strong>Description:</strong> ${incident?.description || 'N/A'}</p>
            <p><strong>Location:</strong> ${incident?.location || 'Not specified'}</p>
            <p><strong>Priority:</strong> HIGH (Critical)</p>
            <p><strong>Time Elapsed:</strong> ${formatTimeElapsed(incident?.createdAt)}</p>
            <br>
            <p style="color: red;"><strong>IMMEDIATE ACTION REQUIRED!</strong></p>
        `

        const adminEmailSent = adminEmail ? await sendEmail(adminEmail, subject, html) : false

        const staffEmailsSent = []
        for (const staffEmail of (staffEmails || [])) {
            if (staffEmail) {
                try {
                    const sent = await sendEmail(staffEmail, subject, html)
                    staffEmailsSent.push(sent)
                } catch (staffError) {
                    console.warn(`Failed to send critical alert to staff ${staffEmail}:`, staffError)
                    staffEmailsSent.push(false)
                }
            }
        }

        const pushSent = await sendPush('CRITICAL EMERGENCY', `Critical incident: ${incident?.title || 'New incident'}`, '/alert-icon.png')

        console.log('🚨 Critical alert notifications sent', { adminEmailSent, pushSent, staffEmailsSent: staffEmailsSent.filter(Boolean).length })
        return { adminEmailSent, pushSent, staffEmailsSent }
    } catch (error) {
        console.error('❌ Failed to send critical alert notifications:', error)
        return { adminEmailSent: false, pushSent: false, staffEmailsSent: [], error: error.message }
    }
}
