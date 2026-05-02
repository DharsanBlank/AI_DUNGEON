/**
 * AI Dungeon Master - Frontend Entry Point
 * Main React application with routing and authentication
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Game from './pages/Game';
import './index.css';

// Auth context for managing user state
export const AuthContext = React.createContext(null);

function App() {
    const [user, setUser] = React.useState(null);
    const [token, setToken] = React.useState(localStorage.getItem('token'));
    
    // Check if user is authenticated on mount
    React.useEffect(() => {
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        
        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
        }
    }, []);
    
    const login = (userData, userToken) => {
        setUser(userData);
        setToken(userToken);
        localStorage.setItem('token', userToken);
        localStorage.setItem('user', JSON.stringify(userData));
    };
    
    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    };
    
    const isAuthenticated = () => {
        return token && user;
    };
    
    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated }}>
            <BrowserRouter>
                <div className="app">
                    <Routes>
                        <Route 
                            path="/login" 
                            element={!isAuthenticated() ? <Login /> : <Navigate to="/game" />} 
                        />
                        <Route 
                            path="/game" 
                            element={isAuthenticated() ? <Game /> : <Navigate to="/login" />} 
                        />
                        <Route 
                            path="/" 
                            element={<Navigate to={isAuthenticated() ? "/game" : "/login" />} 
                        />
                    </Routes>
                </div>
            </BrowserRouter>
        </AuthContext.Provider>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
