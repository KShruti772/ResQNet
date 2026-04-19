import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { auth, db } from './firebase.js'
import { storeOrganizationId } from './utils/emergencyService.js'
import { normalizeOrganizationId } from './utils/emergencyUtils.js'

const UserContext = createContext()

export const useUser = () => useContext(UserContext)

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [userData, setUserData] = useState(null)
    const [authLoading, setAuthLoading] = useState(true)
    const [dataLoading, setDataLoading] = useState(true)

    // 1. Handle Firebase Auth State
    useEffect(() => {
        console.log('UserContext: Setting up auth listener')
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            console.log('UserContext: Auth state changed', {
                uid: firebaseUser?.uid || null,
                email: firebaseUser?.email || null
            })

            setUser(firebaseUser)
            setAuthLoading(false)

            // Reset data loading when user changes
            if (firebaseUser) {
                setDataLoading(true)
            } else {
                storeOrganizationId('')
                setUserData(null)
                setDataLoading(false)
            }
        })

        return unsubscribe
    }, [])

    // 2. Fetch User Data from Firestore
    useEffect(() => {
        if (!user) {
            setUserData(null)
            setDataLoading(false)
            return
        }

        console.log('UserContext: Subscribing to user data for', user.uid)

        let isCancelled = false
        const userDocRef = doc(db, 'users', user.uid)
        const unsubscribe = onSnapshot(
            userDocRef,
            async (userDocSnap) => {
                try {
                    if (!userDocSnap.exists()) {
                        console.log('UserContext: User document does not exist')
                        if (!isCancelled) {
                            storeOrganizationId('')
                            setUserData(null)
                            setDataLoading(false)
                        }
                        return
                    }

                    const data = userDocSnap.data()
                    const organizationId = normalizeOrganizationId(data.organizationId || '')

                    console.log('UserContext: User data fetched', {
                        uid: user.uid,
                        role: data.role,
                        organizationId
                    })

                    let organizationName = ''
                    let organizationMissing = false

                    if (organizationId) {
                        try {
                            const orgDocRef = doc(db, 'organizations', organizationId)
                            const orgDocSnap = await getDoc(orgDocRef)

                            if (orgDocSnap.exists()) {
                                organizationName = orgDocSnap.data().name || ''
                            } else {
                                organizationMissing = true
                                organizationName = "Organization doesn't exist"
                            }
                        } catch (orgError) {
                            console.error('UserContext: Error fetching organization:', orgError)
                            organizationMissing = true
                            organizationName = "Organization doesn't exist"
                        }
                    }

                    if (!isCancelled) {
                        storeOrganizationId(organizationId)
                        setUserData({
                            uid: user.uid,
                            ...data,
                            organizationId,
                            organizationName,
                            organizationMissing
                        })
                        setDataLoading(false)
                    }
                } catch (error) {
                    console.error('UserContext: Error fetching user data:', error)
                    if (!isCancelled) {
                        setUserData(null)
                        setDataLoading(false)
                    }
                }
            },
            (error) => {
                console.error('UserContext: Error listening to user data:', error)
                if (!isCancelled) {
                    setUserData(null)
                    setDataLoading(false)
                }
            }
        )

        return () => {
            isCancelled = true
            unsubscribe()
        }
    }, [user])

    // 3. Fallback timeout to prevent infinite loading
    useEffect(() => {
        console.log('UserContext: Setting up loading timeout')
        const timer = setTimeout(() => {
            console.log('UserContext: Loading timeout reached, forcing loading to false')
            setAuthLoading(false)
            setDataLoading(false)
        }, 5000) // 5 second timeout

        return () => clearTimeout(timer)
    }, [])

    const updateUser = (updates) => {
        console.log('UserContext: Updating user data', updates)
        setUserData(prev => ({ ...prev, ...updates }))
    }

    const contextValue = {
        user,
        userData,
        loading: authLoading || dataLoading,
        authLoading,
        dataLoading,
        updateUser
    }

    console.log('UserContext: Context value', {
        user: user ? { uid: user.uid, email: user.email } : null,
        userData: userData ? { role: userData.role, organizationId: userData.organizationId } : null,
        loading: contextValue.loading,
        authLoading,
        dataLoading
    })

    return (
        <UserContext.Provider value={contextValue}>
            {children}
        </UserContext.Provider>
    )
}
