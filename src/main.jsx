import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>
)

// Install debug tools after app mounts (lazy load to avoid bundle size impact)
setTimeout(() => {
    import('../scripts/statusDashboard.js').then(mod => {
        window.checkEmergencyStatus = mod.checkSystemStatus
        console.log('✅ Status dashboard available: checkEmergencyStatus()')
    }).catch(err => console.log('Status dashboard not available'))

    import('../scripts/integrationTests.js').then(mod => {
        window.runEmergencyTests = mod.runTests
        console.log('✅ Test suite available: runEmergencyTests()')
    }).catch(err => console.log('Test suite not available'))

    import('../scripts/debugFirestoreErrors.js').then(mod => {
        window.__debugFirestore = {
            logContext: mod.logFirestoreContext,
            checkReady: mod.validateQueryReadiness,
            logError: mod.logFirestoreError
        }
        console.log('✅ Error debug tools available: __debugFirestore.*')
    }).catch(err => console.log('Error debug tools not available'))

    console.log('💡 Debug command: await checkEmergencyStatus()')
    console.log('💡 Test command: await runEmergencyTests()')
}, 500)
