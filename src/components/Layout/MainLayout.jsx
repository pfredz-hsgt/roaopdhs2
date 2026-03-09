import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography, Drawer, Button } from 'antd';
import {
    SearchOutlined,
    ShoppingCartOutlined,
    FileTextOutlined,
    SettingOutlined,
    MenuOutlined,
    PushpinOutlined,
    WarningOutlined,
    HistoryOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

const MainLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    const menuItems = [
        {
            key: '/indent',
            icon: <FileTextOutlined />,
            label: 'Indent',
        },
        {
            key: '/cart',
            icon: <ShoppingCartOutlined />,
            label: 'Cart',
        },
        {
            key: '/indent-list',
            icon: <HistoryOutlined />,
            label: 'Previous Indents',
        },
        {
            key: '/shortexp',
            icon: <WarningOutlined />,
            label: 'Short Exp',
        },
        {
            key: '/settings',
            icon: <SettingOutlined />,
            label: 'Settings',
        },
    ];

    const handleMenuClick = ({ key }) => {
        navigate(key);
        setMobileMenuOpen(false);
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            {/* Desktop Sidebar */}
            <Sider
                breakpoint="lg"
                collapsedWidth="0"
                onCollapse={setCollapsed}
                style={{
                    overflow: 'auto',
                    height: '100vh',
                    position: 'fixed',
                    left: 0,
                    top: 0,
                    bottom: 0,
                }}
                className="desktop-sider"
            >
                <div style={{ padding: '24px 16px', textAlign: 'center', background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Title level={4} style={{
                        color: 'white',
                        margin: 0,
                        letterSpacing: '6px',
                        fontWeight: 450,
                        background: 'linear-gradient(to right, #ff9966 0%, #ff5e62 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textTransform: 'uppercase',
                        fontSize: '26px',
                        fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                    }}>
                        OPDHS
                    </Title>
                    <Typography.Text style={{
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: '10px',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginTop: '4px',
                        fontWeight: 400
                    }}>
                        ROA OPD<br />Hosp Segamat
                    </Typography.Text>
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    onClick={handleMenuClick}
                />
            </Sider>

            {/* Mobile Drawer */}
            <Drawer
                placement="left"
                onClose={() => setMobileMenuOpen(false)}
                open={mobileMenuOpen}
                className="mobile-drawer"
                styles={{
                    body: { padding: 0, backgroundColor: '#001529' },
                    header: { display: 'none' }
                }}
                width={200}
            >
                <div style={{ padding: '24px 16px', textAlign: 'center', background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <Title level={4} style={{
                        color: 'white',
                        margin: 0,
                        letterSpacing: '6px',
                        fontWeight: 400,
                        background: 'linear-gradient(to right, #ff9966 0%, #ff5e62 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        textTransform: 'uppercase',
                        fontSize: '24px',
                        fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                    }}>
                        OPDHS
                    </Title>
                    <Typography.Text style={{
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: '10px',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginTop: '4px',
                        fontWeight: 400
                    }}>
                        ROA OPD<br />Hosp Segamat
                    </Typography.Text>
                </div>
                <Menu
                    theme="dark"
                    mode="inline"
                    selectedKeys={[location.pathname]}
                    items={menuItems}
                    onClick={handleMenuClick}
                />
            </Drawer>

            <Layout style={{ marginLeft: collapsed ? 0 : 200 }}>
                <Header
                    className="site-header"
                    style={{
                        padding: '0 16px',
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                >
                    <Button
                        type="text"
                        icon={<MenuOutlined />}
                        onClick={() => setMobileMenuOpen(true)}
                        className="mobile-menu-button"
                        style={{ fontSize: '18px' }}
                    />
                    <Title level={4} style={{ margin: 0 }}>
                        {menuItems.find(item => item.key === location.pathname)?.label || 'OPD-HS'}
                    </Title>
                    <div />
                </Header>
                <Content className="site-content" style={{ margin: '24px 16px', overflow: 'initial' }}>
                    <div style={{ padding: 24, background: '#fff', minHeight: 360, borderRadius: 8 }}>
                        <Outlet />
                    </div>
                </Content>
            </Layout>

            <style>{`
        @media (min-width: 992px) {
          .mobile-menu-button {
            display: none !important;
          }
          .mobile-drawer {
            display: none;
          }
        }
        @media (max-width: 991px) {
          .desktop-sider {
            display: none !important;
          }
          .site-header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            width: 100%;
          }
          .site-content {
            margin-top: 88px !important; /* 64px header + 24px existing top margin */
          }
        }
      `}</style>
        </Layout>
    );
};

export default MainLayout;
