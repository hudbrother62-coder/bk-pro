import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import PasswordRecovery from './password-recovery'
import { client } from './data'
import './style.css'
createRoot(document.getElementById('root')!).render(<React.StrictMode>{new URLSearchParams(window.location.search).has('bbreset') ? <PasswordRecovery client={client}/> : <App />}</React.StrictMode>)
