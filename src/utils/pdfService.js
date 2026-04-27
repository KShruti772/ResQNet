/**
 * Incident PDF export helper using jsPDF
 */
import jsPDF from 'jspdf'

const safeText = (value, fallback = 'N/A') => {
    if (value === undefined || value === null) {
        return fallback
    }

    return String(value)
}

const formatDateTime = (value) => {
    if (!value) {
        return 'N/A'
    }

    const date = value?.seconds ? new Date(value.seconds * 1000) : new Date(value)
    if (Number.isNaN(date.getTime())) {
        return 'N/A'
    }

    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    })
}

const getIncidentLocation = (incident) => {
    const locationValue = incident.location || incident.locationDetails || {}
    const building = safeText(locationValue.building || incident.building || '')
    const floor = safeText(locationValue.floor || incident.floor || '')
    const room = safeText(locationValue.room || incident.room || '')
    const locationParts = []

    if (building && building !== 'N/A') locationParts.push(`Building ${building}`)
    if (floor && floor !== 'N/A') locationParts.push(`Floor ${floor}`)
    if (room && room !== 'N/A') locationParts.push(`Room ${room}`)

    if (locationParts.length > 0) {
        return locationParts.join(', ')
    }

    if (incident.locationLabel) {
        return incident.locationLabel
    }

    if (incident.latitude != null && incident.longitude != null) {
        return `${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)}`
    }

    return 'N/A'
}

const getEventTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time'
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp)
    if (Number.isNaN(date.getTime())) {
        return 'Unknown time'
    }
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    })
}

const renderSection = (doc, label, value, x, y, maxWidth) => {
    doc.setFontSize(10)
    doc.setTextColor(55, 65, 81)
    doc.text(`${label}:`, x, y)
    doc.setFontSize(11)
    doc.setTextColor(17, 24, 39)
    const text = doc.splitTextToSize(safeText(value), maxWidth)
    doc.text(text, x + 110, y)
    return y + text.length * 14
}

const addFooter = (doc, pageNumber) => {
    const footer = `Generated on ${formatDateTime(new Date())}`
    const pageWidth = doc.internal.pageSize.getWidth()
    doc.setFontSize(9)
    doc.setTextColor(128, 128, 128)
    doc.text(footer, pageWidth - 40, doc.internal.pageSize.getHeight() - 20, {
        align: 'right'
    })
    doc.text(`Page ${pageNumber}`, 40, doc.internal.pageSize.getHeight() - 20)
}

export const generateIncidentPDF = (incident) => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' })
    const margin = 40
    const pageWidth = doc.internal.pageSize.getWidth() - margin * 2
    let y = 50

    doc.setFontSize(18)
    doc.setTextColor(17, 24, 39)
    doc.text('Emergency Incident Report', margin, y)
    y += 24

    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text(`Report generated: ${formatDateTime(new Date())}`, margin, y)
    y += 18

    doc.setDrawColor(203, 213, 225)
    doc.setLineWidth(0.5)
    doc.line(margin, y, margin + pageWidth, y)
    y += 24

    doc.setFontSize(13)
    doc.setTextColor(30, 41, 59)
    doc.text('Incident Summary', margin, y)
    y += 18

    const incidentTitle = incident.title || incident.emergencyType || 'Untitled Incident'
    const incidentType = safeText(incident.emergencyType || incident.type || 'General')
    const priority = safeText(incident.priority || incident.priorityLevel || 'Medium')
    const status = safeText(incident.status || 'Pending')
    const assignedStaff = safeText(incident.assignedStaffName || incident.assignedToName || 'Unassigned')
    const organizationName = safeText(incident.organizationName || incident.organizationId || 'Unknown Organization')
    const locationText = getIncidentLocation(incident)
    const createdAtText = formatDateTime(incident.createdAt || incident.created_at)
    const updatedAtText = formatDateTime(incident.updatedAt || incident.updated_at || incident.updatedAt)

    y = renderSection(doc, 'Title', incidentTitle, margin, y, pageWidth - 110)
    y = renderSection(doc, 'Type', incidentType, margin, y, pageWidth - 110)
    y = renderSection(doc, 'Priority', priority, margin, y, pageWidth - 110)
    y = renderSection(doc, 'Status', status, margin, y, pageWidth - 110)
    y = renderSection(doc, 'Assigned Staff', assignedStaff, margin, y, pageWidth - 110)
    y = renderSection(doc, 'Organization', organizationName, margin, y, pageWidth - 110)
    y = renderSection(doc, 'Location', locationText, margin, y, pageWidth - 110)
    y = renderSection(doc, 'Created At', createdAtText, margin, y, pageWidth - 110)
    y = renderSection(doc, 'Updated At', updatedAtText, margin, y, pageWidth - 110)

    y += 10
    doc.setFontSize(12)
    doc.setTextColor(30, 41, 59)
    doc.text('Description', margin, y)
    y += 16

    doc.setFontSize(10)
    doc.setTextColor(51, 65, 85)
    const descriptionText = safeText(incident.description || incident.summary || 'No description available')
    const descriptionLines = doc.splitTextToSize(descriptionText, pageWidth)
    doc.text(descriptionLines, margin, y)
    y += descriptionLines.length * 14 + 18

    doc.setFontSize(13)
    doc.setTextColor(30, 41, 59)
    doc.text('Incident History', margin, y)
    y += 18

    const events = Array.isArray(incident.events) ? incident.events : []
    if (events.length === 0) {
        doc.setFontSize(10)
        doc.setTextColor(107, 114, 128)
        doc.text('No incident history available.', margin, y)
        y += 18
    } else {
        doc.setFontSize(10)
        doc.setTextColor(51, 65, 85)

        events.forEach((event, index) => {
            const eventLabel = safeText(event.event_type || event.type || 'Event')
            const performedBy = safeText(event.performed_by || event.performedBy || 'System')
            const eventTime = getEventTimestamp(event.timestamp)
            const eventText = `${index + 1}. ${eventLabel} • ${performedBy} • ${eventTime}`
            const eventLines = doc.splitTextToSize(eventText, pageWidth)

            if (y + eventLines.length * 14 > doc.internal.pageSize.getHeight() - 80) {
                addFooter(doc, doc.internal.getNumberOfPages())
                doc.addPage()
                y = 50
            }

            doc.text(eventLines, margin, y)
            y += eventLines.length * 14 + 10
        })
    }

    addFooter(doc, doc.internal.getNumberOfPages())

    const safeTitle = incidentTitle.replace(/[^a-zA-Z0-9-_ ]/g, '_').slice(0, 40)
    const fileName = `${safeTitle}-${safeText(incident.id || incident.emergencyId || Date.now())}.pdf`
    doc.save(fileName)
}
