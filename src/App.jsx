import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import MainLayout from './components/Layout/MainLayout';
import IndentPage from './pages/Indent/IndentPage';
import KewPS6Page from './pages/KewPS6/KewPS6Page';
import CartPage from './pages/Cart/CartPage';
import IndentRecordPage from './pages/Cart/IndentRecordPage';
import AdminMenuPage from './pages/Admin/AdminMenu';
import LoginPage from './pages/Auth/LoginPage';
import HomePage from './pages/Home/HomePage';
import RoutineIndentPage from './pages/Indent/RoutineIndentPage';
import RoutineSummaryPage from './pages/Indent/RoutineSummaryPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ShortExpPage from './pages/Shortexp/ShortExpPage';
import { Spin } from 'antd';

const ProtectedRoute = ({ children, requireIssuer = false }) => {
    const { user, isIssuer, loading } = useAuth();

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" /></div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (requireIssuer && !isIssuer) {
        return <Navigate to="/" replace />; // Redirect indenters away from issuer routes
    }

    return children;
};

function App() {
    return (
        <AuthProvider>
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
                    <Route path="/login" element={<LoginPage />} />

                    <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                        <Route index element={<Navigate to="/home" replace />} />
                        <Route path="home" element={<HomePage />} />
                        <Route path="indent" element={<IndentPage />} />
                        <Route path="routine-indent" element={<RoutineIndentPage />} />
                        <Route path="routine-summary" element={<RoutineSummaryPage />} />
                        <Route path="shortexp" element={<ShortExpPage />} />

                        {/* Issuer Only Routes */}
                        <Route path="cart" element={<ProtectedRoute requireIssuer={true}><CartPage /></ProtectedRoute>} />
                        <Route path="indent-list" element={<ProtectedRoute><IndentRecordPage /></ProtectedRoute>} />
                        <Route path="admin" element={<ProtectedRoute requireIssuer={true}><AdminMenuPage /></ProtectedRoute>} />
                    </Route>
                </Routes>
            </ConfigProvider>
        </AuthProvider>
    );
}

export default App;
