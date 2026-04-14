import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase.js'

const UserContext = createContext()

export const useUser = () => useContext(UserContext)

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
                const userData = userDoc.data()
                const orgId = userData?.organizationId
                let orgName = ''
                if (orgId) {
                    const orgDoc = await getDoc(doc(db, 'organizations', orgId))
                    orgName = orgDoc.data()?.name || ''
                }
                setUser({
                    uid: firebaseUser.uid,
                    role: userData?.role || 'user',
                    organizationId: orgId,
                    organizationName: orgName
                })
            } else {
                setUser(null)
            }
            setLoading(false)
        })
        return unsubscribe
    }, [])

    const updateUser = (updates) => {
        setUser(prev => ({ ...prev, ...updates }))
    }

    return (
        <UserContext.Provider value={{ user, loading, updateUser }}>
            {children}
        </UserContext.Provider>
    )
}