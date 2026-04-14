import { getStatusSteps, getCurrentStatusIndex } from '../utils/emergencyUtils'

function StatusTimeline({ status }) {
    const steps = getStatusSteps()
    const currentIndex = getCurrentStatusIndex(status)

    return (
        <div className="flex items-center justify-between mt-4">
            {steps.map((step, index) => (
                <div key={step.key} className="flex items-center flex-1">
                    <div className={`w-3 h-3 rounded-full ${index <= currentIndex ? step.color : 'bg-slate-600'}`} />
                    <span className={`ml-2 text-xs font-medium ${index <= currentIndex ? 'text-white' : 'text-slate-500'}`}>
                        {step.label}
                    </span>
                    {index < steps.length - 1 && (
                        <div className={`flex-1 h-0.5 ml-2 ${index < currentIndex ? step.color : 'bg-slate-600'}`} />
                    )}
                </div>
            ))}
        </div>
    )
}

export default StatusTimeline