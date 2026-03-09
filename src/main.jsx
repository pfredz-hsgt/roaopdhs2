import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom'; // 1. Import HashRouter
import App from './App.jsx';
import 'antd/dist/reset.css';
import './style.css';

ReactDOM.createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <HashRouter>
            <App />
        </HashRouter>
    </React.StrictMode>
);