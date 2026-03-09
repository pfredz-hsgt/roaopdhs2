import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import MainLayout from './components/Layout/MainLayout';
import IndentPage from './pages/Indent/IndentPage';
import ShortExpPage from './pages/Shortexp/ShortExpPage';
import CartPage from './pages/Cart/CartPage';
import IndentListPage from './pages/Cart/IndentListPage';
import SettingsPage from './pages/Settings/SettingsPage';

function App() {
    return (
        <ConfigProvider
            theme={{
                token: {
                    colorPrimary: '#1890ff',
                    borderRadius: 6,
                },
                algorithm: theme.defaultAlgorithm,
            }}
        >

            <Routes>
                <Route path="/" element={<MainLayout />}>
                    <Route index element={<Navigate to="/indent" replace />} />
                    <Route path="indent" element={<IndentPage />} />
                    <Route path="shortexp" element={<ShortExpPage />} />
                    <Route path="cart" element={<CartPage />} />
                    <Route path="indent-list" element={<IndentListPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                </Route>
            </Routes>

        </ConfigProvider>
    );
}

export default App;
