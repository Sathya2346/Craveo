import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { FavouritesProvider } from './context/FavouritesContext.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <ToastProvider>
          <AuthProvider>
            <FavouritesProvider>
              <CartProvider>
                <App />
              </CartProvider>
            </FavouritesProvider>
          </AuthProvider>
        </ToastProvider>
      </SettingsProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
