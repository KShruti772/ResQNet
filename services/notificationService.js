import nodemailer from "nodemailer";

// Email configuration
const emailTransporter = nodemailer.createTransporter({
    service: "gmail",
    auth: {
        user: import.meta.env.VITE_EMAIL_USER,
        pass: import.meta.env.VITE_EMAIL_PASS
    }
});

// Mock SMS service (for demo purposes)
const sendSMSMock = async (phone, message) => {
    console.log(`📱 SMS to ${phone}: ${message}`);
    // In production, integrate with Twilio or similar service
    return true;
};

// Browser notification
const sendBrowserNotification = async (title, body, icon = "/favicon.ico") => {
    if (Notification.permission === "granted") {
        new Notification(title, {
            body,
            icon,
            tag: "emergency-alert"
        });
    }
};

export const sendEmail = async (to, subject, html) => {
    try {
        if (!import.meta.env.VITE_EMAIL_USER || !import.meta.env.VITE_EMAIL_PASS) {
            console.warn("Email credentials not configured, skipping email notification");
            return false;
        }

        const mailOptions = {
            from: import.meta.env.VITE_EMAIL_USER,
            to,
            subject,
            html
        };

        await emailTransporter.sendMail(mailOptions);
        console.log(`📧 Email sent to ${to}: ${subject}`);
        return true;
    } catch (error) {
        console.error("Failed to send email:", error);
        return false;
    }
};

export const sendSMS = async (phone, message) => {
    try {
        // Use mock SMS for demo
        return await sendSMSMock(phone, message);
    } catch (error) {
        console.error("Failed to send SMS:", error);
        return false;
    }
};

export const sendPush = async (title, body) => {
    try {
        return await sendBrowserNotification(title, body);
    } catch (error) {
        console.error("Failed to send push notification:", error);
        return false;
    }
};

// Main notification functions
export const notifyIncidentCreated = async (incident, adminEmail) => {
    try {
        const subject = `🚨 New Emergency Incident: ${incident.title}`;
        const html = `
            <h2>New Emergency Incident Created</h2>
            <p><strong>Title:</strong> ${incident.title}</p>
            <p><strong>Description:</strong> ${incident.description}</p>
            <p><strong>Location:</strong> ${incident.location || "Not specified"}</p>
            <p><strong>Priority:</strong> ${incident.priority || "medium"}</p>
            <p><strong>Reported by:</strong> ${incident.userName || "Unknown"}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <br>
            <p>Please review and assign staff as needed.</p>
        `;

        await sendEmail(adminEmail, subject, html);
        await sendPush("New Incident Created", `Incident: ${incident.title}`);
    } catch (error) {
        console.error("Failed to send incident created notifications:", error);
    }
};

export const notifyStaffAssigned = async (incident, staffEmail, staffPhone) => {
    try {
        const subject = `🚨 Emergency Assignment: ${incident.title}`;
        const html = `
            <h2>You have been assigned to an emergency</h2>
            <p><strong>Incident:</strong> ${incident.title}</p>
            <p><strong>Description:</strong> ${incident.description}</p>
            <p><strong>Location:</strong> ${incident.location || "Not specified"}</p>
            <p><strong>Priority:</strong> ${incident.priority || "medium"}</p>
            <p><strong>Reported by:</strong> ${incident.userName || "Unknown"}</p>
            <p><strong>SLA:</strong> ${incident.sla_limit || 300} seconds</p>
            <br>
            <p>Please respond immediately to this emergency.</p>
        `;

        await sendEmail(staffEmail, subject, html);
        await sendSMS(staffPhone, `EMERGENCY ASSIGNMENT: ${incident.title} at ${incident.location || "Unknown location"}. Priority: ${incident.priority || "medium"}`);
        await sendPush("Emergency Assignment", `Assigned to: ${incident.title}`);
    } catch (error) {
        console.error("Failed to send staff assignment notifications:", error);
    }
};

export const notifyEscalation = async (incident, adminEmail, nextStaffEmail, nextStaffPhone) => {
    try {
        const subject = `⚠️ Emergency Escalated: ${incident.title}`;
        const html = `
            <h2>Emergency Incident Escalated</h2>
            <p><strong>Incident:</strong> ${incident.title}</p>
            <p><strong>Description:</strong> ${incident.description}</p>
            <p><strong>Location:</strong> ${incident.location || "Not specified"}</p>
            <p><strong>Current Priority:</strong> ${incident.priority || "medium"}</p>
            <p><strong>Escalation Level:</strong> ${incident.escalation_level || 1}</p>
            <p><strong>Time Elapsed:</strong> ${Math.floor((Date.now() - incident.createdAt?.seconds * 1000) / 1000)} seconds</p>
            <br>
            <p>The incident has been escalated and reassigned.</p>
        `;

        await sendEmail(adminEmail, subject, html);
        if (nextStaffEmail) {
            await sendEmail(nextStaffEmail, `🚨 URGENT: Escalated Emergency - ${incident.title}`, html);
        }
        if (nextStaffPhone) {
            await sendSMS(nextStaffPhone, `URGENT ESCALATION: ${incident.title} at ${incident.location || "Unknown location"}. Level: ${incident.escalation_level || 1}`);
        }
        await sendPush("Emergency Escalated", `Incident escalated: ${incident.title}`);
    } catch (error) {
        console.error("Failed to send escalation notifications:", error);
    }
};

export const notifyCriticalAlert = async (incident, adminEmail, staffEmails = []) => {
    try {
        const subject = `🚨🚨 CRITICAL EMERGENCY: ${incident.title}`;
        const html = `
            <h2>CRITICAL EMERGENCY ALERT</h2>
            <p style="color: red; font-size: 18px;"><strong>INCIDENT:</strong> ${incident.title}</p>
            <p><strong>Description:</strong> ${incident.description}</p>
            <p><strong>Location:</strong> ${incident.location || "Not specified"}</p>
            <p><strong>Priority:</strong> HIGH (Critical)</p>
            <p><strong>Time Elapsed:</strong> ${Math.floor((Date.now() - incident.createdAt?.seconds * 1000) / 1000)} seconds</p>
            <br>
            <p style="color: red;"><strong>IMMEDIATE ACTION REQUIRED!</strong></p>
        `;

        // Notify admin
        await sendEmail(adminEmail, subject, html);
        
        // Notify all staff
        for (const staffEmail of staffEmails) {
            await sendEmail(staffEmail, subject, html);
        }

        await sendPush("CRITICAL EMERGENCY", `Critical incident: ${incident.title}`, "/alert-icon.png");
    } catch (error) {
        console.error("Failed to send critical alert notifications:", error);
    }
};
